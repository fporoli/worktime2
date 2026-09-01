import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { DateRangeQueryDto } from '../common/date-range-query.dto';
import { CompanyRole } from '../common/enums';
import { AppUser } from '../users/entities/app-user.entity';
import { CreateManagerEdgeDto } from './dto/create-manager-edge.dto';
import { EmployeesService } from './employees.service';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Roles(CompanyRole.ADMIN, CompanyRole.EMPLOYEE_MANAGER)
  @Get()
  list(@CurrentUser() user: AppUser) {
    return this.employeesService.listEmployees(user);
  }

  @Roles(CompanyRole.EMPLOYEE_MANAGER)
  @Get('my-team')
  myTeam(@CurrentUser() user: AppUser) {
    return this.employeesService.listMyTeam(user);
  }

  @Roles(CompanyRole.EMPLOYEE_MANAGER)
  @Get('my-team/time-entries')
  myTeamTimeEntries(@CurrentUser() user: AppUser, @Query() query: DateRangeQueryDto) {
    return this.employeesService.listMyTeamTimeEntries(user, query.from, query.to);
  }

  @Roles(CompanyRole.ADMIN)
  @Get('managers')
  listManagerEdges(@CurrentUser() user: AppUser) {
    return this.employeesService.listManagerEdges(user);
  }

  @Roles(CompanyRole.ADMIN)
  @Post('managers')
  createManagerEdge(@CurrentUser() user: AppUser, @Body() dto: CreateManagerEdgeDto) {
    return this.employeesService.createManagerEdge(user, dto.managerId, dto.employeeId);
  }

  @Roles(CompanyRole.ADMIN)
  @Delete('managers/:id')
  removeManagerEdge(@CurrentUser() user: AppUser, @Param('id') id: string) {
    return this.employeesService.removeManagerEdge(user, id);
  }
}
