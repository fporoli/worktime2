import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SkipOnboarded } from '../auth/decorators/skip-onboarded.decorator';
import { AppUser } from '../users/entities/app-user.entity';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly companiesService: CompaniesService) {}

  @SkipOnboarded()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('standalone')
  async standalone(@CurrentUser() user: AppUser): Promise<void> {
    await this.companiesService.onboardStandalone(user);
  }

  @SkipOnboarded()
  @Post('company')
  async company(@CurrentUser() user: AppUser, @Body() dto: CreateCompanyDto) {
    return this.companiesService.onboardCompany(user, dto.companyName);
  }
}
