import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { Project } from '../../projects/entities/project.entity';
import { AppUser } from '../../users/entities/app-user.entity';

@Entity({ name: 'time_entry' })
@Index(['userId', 'workDate'])
@Check(`"start_minute" >= 0 AND "start_minute" % 5 = 0`)
@Check(`"end_minute" <= 1440 AND "end_minute" % 5 = 0`)
@Check(`"end_minute" > "start_minute"`)
export class TimeEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => AppUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: AppUser;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'work_date', type: 'date' })
  workDate: string;

  @Column({ name: 'start_minute', type: 'smallint' })
  startMinute: number;

  @Column({ name: 'end_minute', type: 'smallint' })
  endMinute: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
