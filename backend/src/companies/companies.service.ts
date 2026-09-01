import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CompanyRole, UserStatus } from '../common/enums';
import { AppUser } from '../users/entities/app-user.entity';
import { MemberResponseDto } from './dto/member-response.dto';
import { CompanyMembership } from './entities/company-membership.entity';
import { Company } from './entities/company.entity';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company) private readonly companyRepository: Repository<Company>,
    @InjectRepository(CompanyMembership)
    private readonly membershipRepository: Repository<CompanyMembership>,
    @InjectRepository(AppUser) private readonly appUserRepository: Repository<AppUser>,
    private readonly dataSource: DataSource,
  ) {}

  async onboardStandalone(user: AppUser): Promise<void> {
    if (user.status !== UserStatus.NEEDS_ONBOARDING) {
      throw new ConflictException('Onboarding has already been completed.');
    }
    await this.appUserRepository.update(user.id, { status: UserStatus.ACTIVE });
  }

  async onboardCompany(user: AppUser, companyName: string): Promise<Company> {
    if (user.status !== UserStatus.NEEDS_ONBOARDING) {
      throw new ConflictException('Onboarding has already been completed.');
    }

    return this.dataSource.transaction(async (manager) => {
      const company = await manager.save(Company, manager.create(Company, { name: companyName }));
      await manager.save(
        CompanyMembership,
        manager.create(CompanyMembership, {
          userId: user.id,
          companyId: company.id,
          roles: [CompanyRole.ADMIN],
        }),
      );
      await manager.update(AppUser, user.id, { status: UserStatus.ACTIVE });
      return company;
    });
  }

  requireCompanyId(user: AppUser): string {
    const companyId = user.membership?.companyId;
    if (!companyId) {
      throw new ForbiddenException('You are not part of a company.');
    }
    return companyId;
  }

  async getCurrentCompany(user: AppUser): Promise<Company> {
    const companyId = this.requireCompanyId(user);
    const company = await this.companyRepository.findOneOrFail({ where: { id: companyId } });
    return company;
  }

  async renameCompany(user: AppUser, name: string): Promise<Company> {
    const companyId = this.requireCompanyId(user);
    await this.companyRepository.update(companyId, { name });
    return this.companyRepository.findOneOrFail({ where: { id: companyId } });
  }

  async listMembers(user: AppUser): Promise<MemberResponseDto[]> {
    const companyId = this.requireCompanyId(user);
    const memberships = await this.membershipRepository.find({
      where: { companyId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
    return memberships.map((m) => ({
      userId: m.userId,
      email: m.user.email,
      displayName: m.user.displayName,
      roles: m.roles,
    }));
  }

  async addMemberByEmail(user: AppUser, email: string): Promise<MemberResponseDto> {
    const companyId = this.requireCompanyId(user);

    const target = await this.appUserRepository.findOne({ where: { email } });
    if (!target) {
      throw new NotFoundException(
        'No account found for that email yet. Ask them to sign up first, then try again.',
      );
    }

    const existingMembership = await this.membershipRepository.findOne({ where: { userId: target.id } });
    if (existingMembership) {
      throw new ConflictException('That user already belongs to a company.');
    }

    const membership = await this.membershipRepository.save(
      this.membershipRepository.create({ userId: target.id, companyId, roles: [] }),
    );

    if (target.status === UserStatus.NEEDS_ONBOARDING) {
      await this.appUserRepository.update(target.id, { status: UserStatus.ACTIVE });
    }

    return { userId: target.id, email: target.email, displayName: target.displayName, roles: membership.roles };
  }

  async removeMember(user: AppUser, targetUserId: string): Promise<void> {
    const companyId = this.requireCompanyId(user);
    const membership = await this.membershipRepository.findOne({ where: { userId: targetUserId, companyId } });
    if (!membership) {
      throw new NotFoundException('That user is not a member of your company.');
    }
    await this.assertNotRemovingLastAdmin(companyId, membership, []);
    await this.membershipRepository.delete({ id: membership.id });
  }

  async updateMemberRoles(user: AppUser, targetUserId: string, roles: CompanyRole[]): Promise<MemberResponseDto> {
    const companyId = this.requireCompanyId(user);
    const membership = await this.membershipRepository.findOne({
      where: { userId: targetUserId, companyId },
      relations: ['user'],
    });
    if (!membership) {
      throw new NotFoundException('That user is not a member of your company.');
    }
    await this.assertNotRemovingLastAdmin(companyId, membership, roles);

    membership.roles = roles;
    await this.membershipRepository.save(membership);
    return { userId: membership.userId, email: membership.user.email, displayName: membership.user.displayName, roles };
  }

  private async assertNotRemovingLastAdmin(
    companyId: string,
    membership: CompanyMembership,
    newRoles: CompanyRole[],
  ): Promise<void> {
    const wasAdmin = membership.roles.includes(CompanyRole.ADMIN);
    const staysAdmin = newRoles.includes(CompanyRole.ADMIN);
    if (!wasAdmin || staysAdmin) {
      return;
    }
    const adminCount = await this.membershipRepository
      .createQueryBuilder('m')
      .where('m.company_id = :companyId', { companyId })
      .andWhere(':admin = ANY(m.roles)', { admin: CompanyRole.ADMIN })
      .getCount();
    if (adminCount <= 1) {
      throw new ConflictException('A company must always have at least one admin.');
    }
  }
}
