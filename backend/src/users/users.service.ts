import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Locale, UserStatus } from '../common/enums';
import { AppUser } from './entities/app-user.entity';
import { MeResponseDto } from './dto/me-response.dto';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(AppUser) private readonly appUserRepository: Repository<AppUser>) {}

  toMeResponse(appUser: AppUser): MeResponseDto {
    return {
      id: appUser.id,
      email: appUser.email,
      displayName: appUser.displayName,
      status: appUser.status,
      needsOnboarding: appUser.status === UserStatus.NEEDS_ONBOARDING,
      locale: appUser.locale,
      company: appUser.membership?.company
        ? { id: appUser.membership.company.id, name: appUser.membership.company.name }
        : null,
      roles: appUser.membership?.roles ?? [],
    };
  }

  async updateLocale(appUser: AppUser, locale: Locale): Promise<MeResponseDto> {
    appUser.locale = locale;
    await this.appUserRepository.update(appUser.id, { locale });
    return this.toMeResponse(appUser);
  }
}
