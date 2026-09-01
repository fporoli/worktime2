import { CompanyRole } from '../../common/enums';

export class MemberResponseDto {
  userId: string;
  email: string;
  displayName: string;
  roles: CompanyRole[];
}
