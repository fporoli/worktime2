import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { AppUser } from '../../users/entities/app-user.entity';

@Entity({ name: 'employee_manager_assignment' })
@Index(['managerId', 'employeeId'], { unique: true })
export class EmployeeManagerAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'manager_id' })
  managerId: string;

  @ManyToOne(() => AppUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'manager_id' })
  manager: AppUser;

  @Column({ name: 'employee_id' })
  employeeId: string;

  @ManyToOne(() => AppUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: AppUser;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
