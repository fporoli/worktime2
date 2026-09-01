import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyRole, ProjectKind } from '../common/enums';
import { TimeEntry } from '../time-entries/entities/time-entry.entity';
import { AppUser } from '../users/entities/app-user.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectAssignment } from './entities/project-assignment.entity';
import { ProjectManagerAssignment } from './entities/project-manager-assignment.entity';
import { Project } from './entities/project.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly projectRepository: Repository<Project>,
    @InjectRepository(ProjectAssignment)
    private readonly assignmentRepository: Repository<ProjectAssignment>,
    @InjectRepository(ProjectManagerAssignment)
    private readonly managerRepository: Repository<ProjectManagerAssignment>,
    @InjectRepository(TimeEntry) private readonly timeEntryRepository: Repository<TimeEntry>,
  ) {}

  private requireCompanyId(user: AppUser): string {
    const companyId = user.membership?.companyId;
    if (!companyId) {
      throw new ForbiddenException('You are not part of a company.');
    }
    return companyId;
  }

  private isAdmin(user: AppUser): boolean {
    return (user.membership?.roles ?? []).includes(CompanyRole.ADMIN);
  }

  private async assertCanManageOrView(user: AppUser, projectId: string): Promise<void> {
    if (this.isAdmin(user)) {
      return;
    }
    const isManager = await this.managerRepository.findOne({ where: { projectId, userId: user.id } });
    if (!isManager) {
      throw new ForbiddenException('You are not a manager of this project.');
    }
  }

  async listProjects(user: AppUser, kind?: ProjectKind): Promise<Project[]> {
    const companyId = this.requireCompanyId(user);
    return this.projectRepository.find({
      where: { companyId, ...(kind ? { kind } : {}) },
      order: { name: 'ASC' },
    });
  }

  async listMyProjects(user: AppUser): Promise<Project[]> {
    const companyId = this.requireCompanyId(user);
    const activities = await this.projectRepository.find({
      where: { companyId, kind: ProjectKind.ACTIVITY, isArchived: false },
    });
    const assignments = await this.assignmentRepository.find({
      where: { userId: user.id },
      relations: ['project'],
    });
    const assignedProjects = assignments
      .map((a) => a.project)
      .filter((p) => p.companyId === companyId && !p.isArchived);
    return [...assignedProjects, ...activities].sort((a, b) => a.name.localeCompare(b.name));
  }

  async listManagedProjects(user: AppUser): Promise<Project[]> {
    const companyId = this.requireCompanyId(user);
    const managerRows = await this.managerRepository.find({ where: { userId: user.id }, relations: ['project'] });
    return managerRows
      .map((m) => m.project)
      .filter((p) => p.companyId === companyId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getProjectOrFail(companyId: string, projectId: string): Promise<Project> {
    const project = await this.projectRepository.findOne({ where: { id: projectId, companyId } });
    if (!project) {
      throw new NotFoundException('Project not found.');
    }
    return project;
  }

  async createProject(user: AppUser, dto: CreateProjectDto): Promise<Project> {
    const companyId = this.requireCompanyId(user);

    let parentProjectId: string | null = null;
    if (dto.kind === ProjectKind.SUBPROJECT) {
      if (!dto.parentProjectId) {
        throw new ConflictException('A subproject requires a parentProjectId.');
      }
      const parent = await this.getProjectOrFail(companyId, dto.parentProjectId);
      if (parent.kind !== ProjectKind.PROJECT) {
        throw new ConflictException('The parent of a subproject must itself be a top-level company project.');
      }
      parentProjectId = parent.id;
    } else if (dto.parentProjectId) {
      throw new ConflictException('Only subprojects may have a parentProjectId.');
    }

    return this.projectRepository.save(
      this.projectRepository.create({ companyId, kind: dto.kind, name: dto.name, parentProjectId }),
    );
  }

  async updateProject(user: AppUser, projectId: string, dto: UpdateProjectDto): Promise<Project> {
    const companyId = this.requireCompanyId(user);
    const project = await this.getProjectOrFail(companyId, projectId);
    Object.assign(project, dto);
    return this.projectRepository.save(project);
  }

  async deleteProject(user: AppUser, projectId: string): Promise<void> {
    const companyId = this.requireCompanyId(user);
    const project = await this.getProjectOrFail(companyId, projectId);
    const entryCount = await this.timeEntryRepository.count({ where: { projectId: project.id } });
    if (entryCount > 0) {
      throw new ConflictException('This project has time entries logged against it — archive it instead of deleting.');
    }
    await this.projectRepository.delete(project.id);
  }

  async listAssignments(user: AppUser, projectId: string) {
    const companyId = this.requireCompanyId(user);
    const project = await this.getProjectOrFail(companyId, projectId);
    await this.assertCanManageOrView(user, project.id);
    const assignments = await this.assignmentRepository.find({ where: { projectId: project.id }, relations: ['user'] });
    return assignments.map((a) => ({ userId: a.userId, email: a.user.email, displayName: a.user.displayName }));
  }

  async listManagers(user: AppUser, projectId: string) {
    const companyId = this.requireCompanyId(user);
    const project = await this.getProjectOrFail(companyId, projectId);
    const managers = await this.managerRepository.find({ where: { projectId: project.id }, relations: ['user'] });
    return managers.map((m) => ({ userId: m.userId, email: m.user.email, displayName: m.user.displayName }));
  }

  async assignEmployee(user: AppUser, projectId: string, targetUserId: string): Promise<void> {
    const companyId = this.requireCompanyId(user);
    const project = await this.getProjectOrFail(companyId, projectId);
    if (project.kind === ProjectKind.ACTIVITY) {
      throw new ConflictException('Activities do not require explicit assignment.');
    }
    const existing = await this.assignmentRepository.findOne({ where: { projectId: project.id, userId: targetUserId } });
    if (existing) {
      return;
    }
    await this.assignmentRepository.save(
      this.assignmentRepository.create({ projectId: project.id, userId: targetUserId }),
    );
  }

  async unassignEmployee(user: AppUser, projectId: string, targetUserId: string): Promise<void> {
    const companyId = this.requireCompanyId(user);
    const project = await this.getProjectOrFail(companyId, projectId);
    await this.assignmentRepository.delete({ projectId: project.id, userId: targetUserId });
  }

  async assignManager(user: AppUser, projectId: string, targetUserId: string): Promise<void> {
    const companyId = this.requireCompanyId(user);
    const project = await this.getProjectOrFail(companyId, projectId);
    if (project.kind === ProjectKind.ACTIVITY) {
      throw new ConflictException('Activities cannot have a project manager.');
    }
    const existing = await this.managerRepository.findOne({ where: { projectId: project.id, userId: targetUserId } });
    if (existing) {
      return;
    }
    await this.managerRepository.save(this.managerRepository.create({ projectId: project.id, userId: targetUserId }));
  }

  async unassignManager(user: AppUser, projectId: string, targetUserId: string): Promise<void> {
    const companyId = this.requireCompanyId(user);
    const project = await this.getProjectOrFail(companyId, projectId);
    await this.managerRepository.delete({ projectId: project.id, userId: targetUserId });
  }

  async listProjectTimeEntries(user: AppUser, projectId: string, from?: string, to?: string) {
    const companyId = this.requireCompanyId(user);
    const project = await this.getProjectOrFail(companyId, projectId);
    await this.assertCanManageOrView(user, project.id);

    const qb = this.timeEntryRepository
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.user', 'user')
      .where('entry.project_id = :projectId', { projectId: project.id });
    if (from) {
      qb.andWhere('entry.work_date >= :from', { from });
    }
    if (to) {
      qb.andWhere('entry.work_date <= :to', { to });
    }
    return qb.orderBy('entry.work_date', 'DESC').addOrderBy('entry.start_minute', 'ASC').getMany();
  }
}
