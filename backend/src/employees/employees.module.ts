import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyMembership } from '../companies/entities/company-membership.entity';
import { TimeEntry } from '../time-entries/entities/time-entry.entity';
import { EmployeeManagerAssignment } from './entities/employee-manager-assignment.entity';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({
  imports: [TypeOrmModule.forFeature([EmployeeManagerAssignment, CompanyMembership, TimeEntry])],
  controllers: [EmployeesController],
  providers: [EmployeesService],
})
export class EmployeesModule {}
