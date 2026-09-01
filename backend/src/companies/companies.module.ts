import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppUser } from '../users/entities/app-user.entity';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyMembership } from './entities/company-membership.entity';
import { Company } from './entities/company.entity';
import { OnboardingController } from './onboarding.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Company, CompanyMembership, AppUser])],
  controllers: [CompaniesController, OnboardingController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
