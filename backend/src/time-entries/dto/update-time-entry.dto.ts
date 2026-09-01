import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class UpdateTimeEntryDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1435)
  startMinute?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  endMinute?: number;
}
