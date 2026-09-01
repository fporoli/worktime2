import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CompanyRole, ProjectKind } from '../common/enums';
import { DateRangeQueryDto } from '../common/date-range-query.dto';
import { AppUser } from '../users/entities/app-user.entity';
import { AssignUserDto } from './dto/assign-user.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list(@CurrentUser() user: AppUser, @Query('kind') kind?: ProjectKind) {
    return this.projectsService.listProjects(user, kind);
  }

  @Get('mine')
  listMine(@CurrentUser() user: AppUser) {
    return this.projectsService.listMyProjects(user);
  }

  @Get('managed')
  listManaged(@CurrentUser() user: AppUser) {
    return this.projectsService.listManagedProjects(user);
  }

  @Roles(CompanyRole.ADMIN)
  @Post()
  create(@CurrentUser() user: AppUser, @Body() dto: CreateProjectDto) {
    return this.projectsService.createProject(user, dto);
  }

  @Roles(CompanyRole.ADMIN)
  @Patch(':id')
  update(@CurrentUser() user: AppUser, @Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.updateProject(user, id, dto);
  }

  @Roles(CompanyRole.ADMIN)
  @Delete(':id')
  remove(@CurrentUser() user: AppUser, @Param('id') id: string) {
    return this.projectsService.deleteProject(user, id);
  }

  @Get(':id/assignments')
  listAssignments(@CurrentUser() user: AppUser, @Param('id') id: string) {
    return this.projectsService.listAssignments(user, id);
  }

  @Roles(CompanyRole.ADMIN)
  @Post(':id/assignments')
  assign(@CurrentUser() user: AppUser, @Param('id') id: string, @Body() dto: AssignUserDto) {
    return this.projectsService.assignEmployee(user, id, dto.userId);
  }

  @Roles(CompanyRole.ADMIN)
  @Delete(':id/assignments/:userId')
  unassign(@CurrentUser() user: AppUser, @Param('id') id: string, @Param('userId') userId: string) {
    return this.projectsService.unassignEmployee(user, id, userId);
  }

  @Get(':id/managers')
  listManagers(@CurrentUser() user: AppUser, @Param('id') id: string) {
    return this.projectsService.listManagers(user, id);
  }

  @Roles(CompanyRole.ADMIN)
  @Post(':id/managers')
  assignManager(@CurrentUser() user: AppUser, @Param('id') id: string, @Body() dto: AssignUserDto) {
    return this.projectsService.assignManager(user, id, dto.userId);
  }

  @Roles(CompanyRole.ADMIN)
  @Delete(':id/managers/:userId')
  unassignManager(@CurrentUser() user: AppUser, @Param('id') id: string, @Param('userId') userId: string) {
    return this.projectsService.unassignManager(user, id, userId);
  }

  @Get(':id/time-entries')
  timeEntries(@CurrentUser() user: AppUser, @Param('id') id: string, @Query() query: DateRangeQueryDto) {
    return this.projectsService.listProjectTimeEntries(user, id, query.from, query.to);
  }
}
