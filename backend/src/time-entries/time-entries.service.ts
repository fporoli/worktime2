import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ProjectKind } from '../common/enums';
import { ProjectAssignment } from '../projects/entities/project-assignment.entity';
import { Project } from '../projects/entities/project.entity';
import { AppUser } from '../users/entities/app-user.entity';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { TimeEntry } from './entities/time-entry.entity';

@Injectable()
export class TimeEntriesService {
  constructor(
    @InjectRepository(TimeEntry) private readonly timeEntryRepository: Repository<TimeEntry>,
    @InjectRepository(Project) private readonly projectRepository: Repository<Project>,
    @InjectRepository(ProjectAssignment) private readonly assignmentRepository: Repository<ProjectAssignment>,
    private readonly dataSource: DataSource,
  ) {}

  private requireCompanyId(user: AppUser): string {
    const companyId = user.membership?.companyId;
    if (!companyId) {
      throw new ForbiddenException('You are not part of a company.');
    }
    return companyId;
  }

  private validateSegment(startMinute: number, endMinute: number): void {
    if (startMinute % 5 !== 0 || endMinute % 5 !== 0) {
      throw new BadRequestException('Start and end time must be rounded to 5 minutes.');
    }
    if (endMinute <= startMinute) {
      throw new BadRequestException('End time must be after start time.');
    }
  }

  private async assertProjectAccessible(companyId: string, userId: string, projectId: string): Promise<Project> {
    const project = await this.projectRepository.findOne({ where: { id: projectId, companyId } });
    if (!project || project.isArchived) {
      throw new NotFoundException('Project or activity not found.');
    }
    if (project.kind !== ProjectKind.ACTIVITY) {
      const assignment = await this.assignmentRepository.findOne({ where: { projectId, userId } });
      if (!assignment) {
        throw new ForbiddenException('You are not assigned to this project.');
      }
    }
    return project;
  }

  private async assertNoOverlap(
    userId: string,
    workDate: string,
    startMinute: number,
    endMinute: number,
    excludeId?: string,
  ): Promise<void> {
    const qb = this.timeEntryRepository
      .createQueryBuilder('entry')
      .where('entry.user_id = :userId', { userId })
      .andWhere('entry.work_date = :workDate', { workDate })
      .andWhere('entry.start_minute < :endMinute', { endMinute })
      .andWhere('entry.end_minute > :startMinute', { startMinute });
    if (excludeId) {
      qb.andWhere('entry.id != :excludeId', { excludeId });
    }
    const overlapping = await qb.getCount();
    if (overlapping > 0) {
      throw new BadRequestException('This segment overlaps with another entry on the same day.');
    }
  }

  async listMine(user: AppUser, from?: string, to?: string): Promise<TimeEntry[]> {
    const qb = this.timeEntryRepository
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.project', 'project')
      .where('entry.user_id = :userId', { userId: user.id });
    if (from) {
      qb.andWhere('entry.work_date >= :from', { from });
    }
    if (to) {
      qb.andWhere('entry.work_date <= :to', { to });
    }
    return qb.orderBy('entry.work_date', 'DESC').addOrderBy('entry.start_minute', 'ASC').getMany();
  }

  async create(user: AppUser, dto: CreateTimeEntryDto): Promise<TimeEntry> {
    const companyId = this.requireCompanyId(user);
    this.validateSegment(dto.startMinute, dto.endMinute);

    return this.dataSource.transaction(async (manager) => {
      await this.assertProjectAccessible(companyId, user.id, dto.projectId);
      await this.assertNoOverlap(user.id, dto.workDate, dto.startMinute, dto.endMinute);
      return manager.save(
        TimeEntry,
        manager.create(TimeEntry, {
          userId: user.id,
          companyId,
          projectId: dto.projectId,
          workDate: dto.workDate,
          startMinute: dto.startMinute,
          endMinute: dto.endMinute,
        }),
      );
    });
  }

  private async getOwnEntryOrFail(user: AppUser, id: string): Promise<TimeEntry> {
    const entry = await this.timeEntryRepository.findOne({ where: { id } });
    if (!entry || entry.userId !== user.id) {
      throw new NotFoundException('Time entry not found.');
    }
    return entry;
  }

  async update(user: AppUser, id: string, dto: UpdateTimeEntryDto): Promise<TimeEntry> {
    const companyId = this.requireCompanyId(user);
    const entry = await this.getOwnEntryOrFail(user, id);

    const startMinute = dto.startMinute ?? entry.startMinute;
    const endMinute = dto.endMinute ?? entry.endMinute;
    this.validateSegment(startMinute, endMinute);

    return this.dataSource.transaction(async (manager) => {
      if (dto.projectId && dto.projectId !== entry.projectId) {
        await this.assertProjectAccessible(companyId, user.id, dto.projectId);
        entry.projectId = dto.projectId;
      }
      await this.assertNoOverlap(user.id, entry.workDate, startMinute, endMinute, entry.id);
      entry.startMinute = startMinute;
      entry.endMinute = endMinute;
      return manager.save(TimeEntry, entry);
    });
  }

  async remove(user: AppUser, id: string): Promise<void> {
    const entry = await this.getOwnEntryOrFail(user, id);
    await this.timeEntryRepository.delete({ id: entry.id });
  }
}
