import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CompanyRole } from '../../common/enums';
import { AppUser } from '../../users/entities/app-user.entity';
import { Company } from './company.entity';

@Entity({ name: 'company_membership' })
export class CompanyMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'user_id', unique: true })
  userId: string;

  @OneToOne(() => AppUser)
  @JoinColumn({ name: 'user_id' })
  user: AppUser;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ type: 'enum', enum: CompanyRole, array: true, default: '{}' })
  roles: CompanyRole[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
