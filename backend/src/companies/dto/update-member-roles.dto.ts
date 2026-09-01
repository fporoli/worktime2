import { ArrayUnique, IsArray, IsEnum } from 'class-validator';
import { CompanyRole } from '../../common/enums';

export class UpdateMemberRolesDto {
  @IsArray()
  @ArrayUnique()
  @IsEnum(CompanyRole, { each: true })
  roles: CompanyRole[];
}
