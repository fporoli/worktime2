import { IsUUID } from 'class-validator';

export class CreateManagerEdgeDto {
  @IsUUID()
  managerId: string;

  @IsUUID()
  employeeId: string;
}
