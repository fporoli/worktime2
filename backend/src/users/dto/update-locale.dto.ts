import { IsEnum } from 'class-validator';
import { Locale } from '../../common/enums';

export class UpdateLocaleDto {
  @IsEnum(Locale)
  locale: Locale;
}
