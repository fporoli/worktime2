import { CompanyRole, Locale, UserStatus } from '../../common/enums';

export class MeResponseDto {
  id: string;
  email: string;
  displayName: string;
  status: UserStatus;
  needsOnboarding: boolean;
  locale: Locale;
  company: { id: string; name: string } | null;
  roles: CompanyRole[];
}
