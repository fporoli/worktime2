import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProjectKind } from '../../common/enums';
import { Company } from '../../companies/entities/company.entity';

@Entity({ name: 'project' })
@Check(`("kind" = 'SUBPROJECT') = ("parent_project_id" IS NOT NULL)`)
@Index(['companyId', 'kind'])
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ type: 'enum', enum: ProjectKind })
  kind: ProjectKind;

  @Column({ name: 'parent_project_id', nullable: true })
  parentProjectId: string | null;

  @ManyToOne(() => Project, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'parent_project_id' })
  parentProject?: Project | null;

  @Column()
  name: string;

  @Column({ name: 'is_archived', default: false })
  isArchived: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
