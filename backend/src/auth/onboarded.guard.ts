import { CanActivate, ConflictException, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserStatus } from '../common/enums';
import { AuthenticatedRequest } from './authenticated-request.interface';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { SKIP_ONBOARDED_KEY } from './decorators/skip-onboarded.decorator';

@Injectable()
export class OnboardedGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ONBOARDED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic || skip) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.appUser.status !== UserStatus.ACTIVE) {
      throw new ConflictException('Account onboarding is not complete.');
    }
    return true;
  }
}
