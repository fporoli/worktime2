import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SkipOnboarded } from '../auth/decorators/skip-onboarded.decorator';
import { AppUser } from './entities/app-user.entity';
import { MeResponseDto } from './dto/me-response.dto';
import { UpdateLocaleDto } from './dto/update-locale.dto';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @SkipOnboarded()
  @Get('me')
  getMe(@CurrentUser() user: AppUser): MeResponseDto {
    return this.usersService.toMeResponse(user);
  }

  @SkipOnboarded()
  @Patch('me/locale')
  updateLocale(@CurrentUser() user: AppUser, @Body() dto: UpdateLocaleDto): Promise<MeResponseDto> {
    return this.usersService.updateLocale(user, dto.locale);
  }
}
