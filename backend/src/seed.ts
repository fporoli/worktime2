import 'reflect-metadata';
import dataSource from './config/typeorm.datasource';
import { CompanyRole, UserStatus } from './common/enums';
import { AppUser } from './users/entities/app-user.entity';
import { Company } from './companies/entities/company.entity';
import { CompanyMembership } from './companies/entities/company-membership.entity';
import { EmployeeManagerAssignment } from './employees/entities/employee-manager-assignment.entity';

// Matches the demo accounts declared in keycloak/realm-config/worktime-realm.yaml. Keycloak
// assigns its own id at creation time, so each user's keycloak_id is looked up here by email
// (from auth.user_entity, the same Postgres database Keycloak uses) rather than a fixed id.
const COMPANY_NAME = 'Acme Inc.';

const USERS: { email: string; displayName: string; roles: CompanyRole[] }[] = [
  { email: 'alice@example.com', displayName: 'Alice Example', roles: [CompanyRole.ADMIN] },
  { email: 'bob@example.com', displayName: 'Bob Example', roles: [CompanyRole.EMPLOYEE_MANAGER] },
  { email: 'james@example.com', displayName: 'James Example', roles: [] },
];

async function seed() {
  await dataSource.initialize();

  const companyRepo = dataSource.getRepository(Company);
  const userRepo = dataSource.getRepository(AppUser);
  const membershipRepo = dataSource.getRepository(CompanyMembership);
  const assignmentRepo = dataSource.getRepository(EmployeeManagerAssignment);

  let company = await companyRepo.findOne({ where: { name: COMPANY_NAME } });
  if (!company) {
    company = await companyRepo.save(companyRepo.create({ name: COMPANY_NAME }));
  }

  const usersByEmail = new Map<string, AppUser>();
  for (const seedUser of USERS) {
    const keycloakRows: { id: string }[] = await dataSource.query(
      `SELECT id FROM auth.user_entity WHERE email = $1`,
      [seedUser.email],
    );
    if (keycloakRows.length === 0) {
      throw new Error(`No Keycloak user found for ${seedUser.email} - has the realm import run yet?`);
    }
    const keycloakId = keycloakRows[0].id;

    let user = await userRepo.findOne({ where: { keycloakId } });
    user = userRepo.create({
      ...user,
      keycloakId,
      email: seedUser.email,
      displayName: seedUser.displayName,
      status: UserStatus.ACTIVE,
    });
    user = await userRepo.save(user);
    usersByEmail.set(seedUser.email, user);

    let membership = await membershipRepo.findOne({ where: { userId: user.id } });
    membership = membershipRepo.create({
      ...membership,
      userId: user.id,
      companyId: company.id,
      roles: seedUser.roles,
    });
    await membershipRepo.save(membership);
  }

  const bob = usersByEmail.get('bob@example.com')!;
  const james = usersByEmail.get('james@example.com')!;

  const existingAssignment = await assignmentRepo.findOne({ where: { managerId: bob.id, employeeId: james.id } });
  if (!existingAssignment) {
    await assignmentRepo.save(
      assignmentRepo.create({ companyId: company.id, managerId: bob.id, employeeId: james.id }),
    );
  }

  console.log(`Seeded "${COMPANY_NAME}": Alice (admin), Bob (manager), James (managed by Bob).`);
  await dataSource.destroy();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
