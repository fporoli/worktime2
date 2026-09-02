import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { AppUser } from '../users/entities/app-user.entity';
import { Company } from '../companies/entities/company.entity';
import { CompanyMembership } from '../companies/entities/company-membership.entity';
import { Project } from '../projects/entities/project.entity';
import { ProjectAssignment } from '../projects/entities/project-assignment.entity';
import { ProjectManagerAssignment } from '../projects/entities/project-manager-assignment.entity';
import { EmployeeManagerAssignment } from '../employees/entities/employee-manager-assignment.entity';
import { TimeEntry } from '../time-entries/entities/time-entry.entity';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  schema: process.env.DATABASE_SCHEMA ?? 'app',
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  entities: [
    AppUser,
    Company,
    CompanyMembership,
    Project,
    ProjectAssignment,
    ProjectManagerAssignment,
    EmployeeManagerAssignment,
    TimeEntry,
  ],
  migrations: ['migrations/*.ts'],
  synchronize: false,
});
