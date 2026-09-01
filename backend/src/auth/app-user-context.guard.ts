import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { UserStatus } from '../common/enums';
import { AppUser } from '../users/entities/app-user.entity';
import { AuthenticatedRequest } from './authenticated-request.interface';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';

@Injectable()
export class AppUserContextGuard implements CanActivate {
  constructor(
    @InjectRepository(AppUser) private readonly appUserRepository: Repository<AppUser>,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { sub, email, name, preferred_username, given_name, family_name } = request.user;

    let appUser = await this.appUserRepository.findOne({
      where: { keycloakId: sub },
      relations: ['membership', 'membership.company'],
    });

    if (!appUser) {
      const displayName = name ?? [given_name, family_name].filter(Boolean).join(' ') ?? preferred_username ?? email;
      try {
        appUser = await this.appUserRepository.save(
          this.appUserRepository.create({
            keycloakId: sub,
            email,
            displayName: displayName || email,
            status: UserStatus.NEEDS_ONBOARDING,
          }),
        );
      } catch (error) {
        if (error instanceof QueryFailedError && (error as unknown as { code?: string }).code === '23505') {
          appUser = await this.appUserRepository.findOneOrFail({
            where: { keycloakId: sub },
            relations: ['membership', 'membership.company'],
          });
        } else {
          throw error;
        }
      }
    }

    request.appUser = appUser;
    return true;
  }
}
