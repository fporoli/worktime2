import { Request } from 'express';
import { AppUser } from '../users/entities/app-user.entity';
import { JwtPayload } from './jwt-payload.interface';

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
  appUser: AppUser;
}
