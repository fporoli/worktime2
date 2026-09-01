import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { AppUser } from './users/entities/app-user.entity';
import { Company } from './companies/entities/company.entity';
import { CompanyMembership } from './companies/entities/company-membership.entity';
import { Project } from './projects/entities/project.entity';
import { ProjectAssignment } from './projects/entities/project-assignment.entity';
import { ProjectManagerAssignment } from './projects/entities/project-manager-assignment.entity';
import { EmployeeManagerAssignment } from './employees/entities/employee-manager-assignment.entity';
import { TimeEntry } from './time-entries/entities/time-entry.entity';
import { EmployeesModule } from './employees/employees.module';
import { HealthController } from './health/health.controller';
import { ProjectsModule } from './projects/projects.module';
import { TimeEntriesModule } from './time-entries/time-entries.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validationSchema }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('app.databaseUrl'),
        schema: configService.get<string>('app.databaseSchema'),
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
        synchronize: false,
        migrationsRun: false,
      }),
    }),
    AuthModule,
    UsersModule,
    CompaniesModule,
    ProjectsModule,
    EmployeesModule,
    TimeEntriesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
