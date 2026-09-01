import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ProjectKind } from '../../common/enums';

export class CreateProjectDto {
  @IsEnum(ProjectKind)
  kind: ProjectKind;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsUUID()
  parentProjectId?: string;
}
