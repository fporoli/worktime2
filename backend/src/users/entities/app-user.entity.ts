import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Locale, UserStatus } from '../../common/enums';
import { CompanyMembership } from '../../companies/entities/company-membership.entity';

@Entity({ name: 'app_user' })
export class AppUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'keycloak_id', unique: true })
  keycloakId: string;

  @Column()
  email: string;

  @Column({ name: 'display_name' })
  displayName: string;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.NEEDS_ONBOARDING })
  status: UserStatus;

  @Column({ type: 'enum', enum: Locale, default: Locale.EN })
  locale: Locale;

  @OneToOne(() => CompanyMembership, (membership) => membership.user)
  membership?: CompanyMembership;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
