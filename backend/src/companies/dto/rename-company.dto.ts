import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RenameCompanyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;
}
