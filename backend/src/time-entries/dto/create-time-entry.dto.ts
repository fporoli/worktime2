import { IsDateString, IsInt, IsUUID, Max, Min } from 'class-validator';

export class CreateTimeEntryDto {
  @IsUUID()
  projectId: string;

  @IsDateString()
  workDate: string;

  @IsInt()
  @Min(0)
  @Max(1435)
  startMinute: number;

  @IsInt()
  @Min(5)
  @Max(1440)
  endMinute: number;
}
