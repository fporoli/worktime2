import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CompanyRole } from '../common/enums';
import { AppUser } from '../users/entities/app-user.entity';
import { CompaniesService } from './companies.service';
import { AddMemberDto } from './dto/add-member.dto';
import { RenameCompanyDto } from './dto/rename-company.dto';
import { UpdateMemberRolesDto } from './dto/update-member-roles.dto';

@Controller('companies/current')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  getCurrent(@CurrentUser() user: AppUser) {
    return this.companiesService.getCurrentCompany(user);
  }

  @Roles(CompanyRole.ADMIN)
  @Patch()
  rename(@CurrentUser() user: AppUser, @Body() dto: RenameCompanyDto) {
    return this.companiesService.renameCompany(user, dto.name);
  }

  @Roles(CompanyRole.ADMIN, CompanyRole.EMPLOYEE_MANAGER)
  @Get('members')
  listMembers(@CurrentUser() user: AppUser) {
    return this.companiesService.listMembers(user);
  }

  @Roles(CompanyRole.ADMIN)
  @Post('members')
  addMember(@CurrentUser() user: AppUser, @Body() dto: AddMemberDto) {
    return this.companiesService.addMemberByEmail(user, dto.email);
  }

  @Roles(CompanyRole.ADMIN)
  @Delete('members/:userId')
  removeMember(@CurrentUser() user: AppUser, @Param('userId') userId: string) {
    return this.companiesService.removeMember(user, userId);
  }

  @Roles(CompanyRole.ADMIN)
  @Patch('members/:userId/roles')
  updateMemberRoles(
    @CurrentUser() user: AppUser,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRolesDto,
  ) {
    return this.companiesService.updateMemberRoles(user, userId, dto.roles);
  }
}
