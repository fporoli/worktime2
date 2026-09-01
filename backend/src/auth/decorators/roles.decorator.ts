import { SetMetadata } from '@nestjs/common';
import { CompanyRole } from '../../common/enums';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: CompanyRole[]): MethodDecorator & ClassDecorator => SetMetadata(ROLES_KEY, roles);
