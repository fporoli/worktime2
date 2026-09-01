import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyMembership } from '../companies/entities/company-membership.entity';
import { CompanyRole } from '../common/enums';
import { TimeEntry } from '../time-entries/entities/time-entry.entity';
import { AppUser } from '../users/entities/app-user.entity';
import { EmployeeManagerAssignment } from './entities/employee-manager-assignment.entity';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(EmployeeManagerAssignment)
    private readonly managerEdgeRepository: Repository<EmployeeManagerAssignment>,
    @InjectRepository(CompanyMembership)
    private readonly membershipRepository: Repository<CompanyMembership>,
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

  async listEmployees(user: AppUser) {
    const companyId = this.requireCompanyId(user);

    if (this.isAdmin(user)) {
      const memberships = await this.membershipRepository.find({ where: { companyId }, relations: ['user'] });
      return memberships.map((m) => ({
        userId: m.userId,
        email: m.user.email,
        displayName: m.user.displayName,
        roles: m.roles,
      }));
    }

    return this.listMyTeam(user);
  }

  async listMyTeam(user: AppUser) {
    const edges = await this.managerEdgeRepository.find({ where: { managerId: user.id }, relations: ['employee'] });
    return edges.map((e) => ({ userId: e.employeeId, email: e.employee.email, displayName: e.employee.displayName }));
  }

  async listManagerEdges(user: AppUser) {
    const companyId = this.requireCompanyId(user);
    const edges = await this.managerEdgeRepository.find({
      where: { companyId },
      relations: ['manager', 'employee'],
      order: { createdAt: 'ASC' },
    });
    return edges.map((e) => ({
      id: e.id,
      managerId: e.managerId,
      managerName: e.manager.displayName,
      employeeId: e.employeeId,
      employeeName: e.employee.displayName,
    }));
  }

  async createManagerEdge(user: AppUser, managerId: string, employeeId: string): Promise<void> {
    const companyId = this.requireCompanyId(user);
    if (managerId === employeeId) {
      throw new ConflictException('A user cannot manage themselves.');
    }

    const [managerMembership, employeeMembership] = await Promise.all([
      this.membershipRepository.findOne({ where: { userId: managerId, companyId } }),
      this.membershipRepository.findOne({ where: { userId: employeeId, companyId } }),
    ]);
    if (!managerMembership || !employeeMembership) {
      throw new NotFoundException('Both users must belong to your company.');
    }

    const existing = await this.managerEdgeRepository.findOne({ where: { managerId, employeeId } });
    if (existing) {
      return;
    }
    await this.managerEdgeRepository.save(
      this.managerEdgeRepository.create({ companyId, managerId, employeeId }),
    );
  }

  async removeManagerEdge(user: AppUser, edgeId: string): Promise<void> {
    const companyId = this.requireCompanyId(user);
    const edge = await this.managerEdgeRepository.findOne({ where: { id: edgeId, companyId } });
    if (!edge) {
      throw new NotFoundException('Manager assignment not found.');
    }
    await this.managerEdgeRepository.delete({ id: edge.id });
  }

  async listMyTeamTimeEntries(user: AppUser, from?: string, to?: string) {
    const reportIds = (await this.managerEdgeRepository.find({ where: { managerId: user.id } })).map(
      (e) => e.employeeId,
    );
    if (reportIds.length === 0) {
      return [];
    }

    const qb = this.timeEntryRepository
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.user', 'user')
      .leftJoinAndSelect('entry.project', 'project')
      .where('entry.user_id IN (:...reportIds)', { reportIds });
    if (from) {
      qb.andWhere('entry.work_date >= :from', { from });
    }
    if (to) {
      qb.andWhere('entry.work_date <= :to', { to });
    }
    return qb.orderBy('entry.work_date', 'DESC').addOrderBy('entry.start_minute', 'ASC').getMany();
  }
}
