export type UserStatus = 'NEEDS_ONBOARDING' | 'ACTIVE';
export type CompanyRole = 'ADMIN' | 'EMPLOYEE_MANAGER';
export type ProjectKind = 'PROJECT' | 'SUBPROJECT' | 'ACTIVITY';
export type Locale = 'en' | 'de' | 'fr';

export interface Me {
  id: string;
  email: string;
  displayName: string;
  status: UserStatus;
  needsOnboarding: boolean;
  locale: Locale;
  company: { id: string; name: string } | null;
  roles: CompanyRole[];
}

export interface Company {
  id: string;
  name: string;
  createdAt: string;
}

export interface Member {
  userId: string;
  email: string;
  displayName: string;
  roles: CompanyRole[];
}

export interface Project {
  id: string;
  companyId: string;
  kind: ProjectKind;
  parentProjectId: string | null;
  name: string;
  isArchived: boolean;
  createdAt: string;
}

export interface ProjectAssignee {
  userId: string;
  email: string;
  displayName: string;
}

export interface TimeEntry {
  id: string;
  userId: string;
  companyId: string;
  projectId: string;
  workDate: string;
  startMinute: number;
  endMinute: number;
  createdAt: string;
  updatedAt: string;
  project?: Project;
  user?: { id: string; email: string; displayName: string };
}

export interface ManagerEdge {
  userId: string;
  email: string;
  displayName: string;
}

export interface ManagerAssignment {
  id: string;
  managerId: string;
  managerName: string;
  employeeId: string;
  employeeName: string;
}
