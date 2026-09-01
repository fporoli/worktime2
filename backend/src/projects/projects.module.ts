import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeEntry } from '../time-entries/entities/time-entry.entity';
import { ProjectAssignment } from './entities/project-assignment.entity';
import { ProjectManagerAssignment } from './entities/project-manager-assignment.entity';
import { Project } from './entities/project.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [TypeOrmModule.forFeature([Project, ProjectAssignment, ProjectManagerAssignment, TimeEntry])],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
