import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectAssignment } from '../projects/entities/project-assignment.entity';
import { Project } from '../projects/entities/project.entity';
import { TimeEntry } from './entities/time-entry.entity';
import { TimeEntriesController } from './time-entries.controller';
import { TimeEntriesService } from './time-entries.service';

@Module({
  imports: [TypeOrmModule.forFeature([TimeEntry, Project, ProjectAssignment])],
  controllers: [TimeEntriesController],
  providers: [TimeEntriesService],
})
export class TimeEntriesModule {}
