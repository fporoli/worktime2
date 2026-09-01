import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AppUser } from '../../users/entities/app-user.entity';
import { AuthenticatedRequest } from '../authenticated-request.interface';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AppUser => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.appUser;
});
