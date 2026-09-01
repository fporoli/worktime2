import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1700000000000 implements MigrationInterface {
  name = 'InitSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "app"."user_status_enum" AS ENUM ('NEEDS_ONBOARDING', 'ACTIVE')`);
    await queryRunner.query(`CREATE TYPE "app"."company_role_enum" AS ENUM ('ADMIN', 'EMPLOYEE_MANAGER')`);
    await queryRunner.query(`CREATE TYPE "app"."project_kind_enum" AS ENUM ('PROJECT', 'SUBPROJECT', 'ACTIVITY')`);

    await queryRunner.query(`
      CREATE TABLE "app"."app_user" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "keycloak_id" varchar NOT NULL,
        "email" varchar NOT NULL,
        "display_name" varchar NOT NULL,
        "status" "app"."user_status_enum" NOT NULL DEFAULT 'NEEDS_ONBOARDING',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_app_user_keycloak_id" UNIQUE ("keycloak_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "app"."company" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "app"."company_membership" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "company_id" uuid NOT NULL,
        "roles" "app"."company_role_enum"[] NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_company_membership_user_id" UNIQUE ("user_id"),
        CONSTRAINT "FK_company_membership_user" FOREIGN KEY ("user_id") REFERENCES "app"."app_user"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_company_membership_company" FOREIGN KEY ("company_id") REFERENCES "app"."company"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_company_membership_company_id" ON "app"."company_membership" ("company_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "app"."project" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "kind" "app"."project_kind_enum" NOT NULL,
        "parent_project_id" uuid,
        "name" varchar NOT NULL,
        "is_archived" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_project_company" FOREIGN KEY ("company_id") REFERENCES "app"."company"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_project_parent" FOREIGN KEY ("parent_project_id") REFERENCES "app"."project"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_project_subproject_parent" CHECK (("kind" = 'SUBPROJECT') = ("parent_project_id" IS NOT NULL))
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_project_company_kind" ON "app"."project" ("company_id", "kind")`);

    await queryRunner.query(`
      CREATE TABLE "app"."project_assignment" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_project_assignment_project" FOREIGN KEY ("project_id") REFERENCES "app"."project"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_project_assignment_user" FOREIGN KEY ("user_id") REFERENCES "app"."app_user"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_project_assignment" UNIQUE ("project_id", "user_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "app"."project_manager_assignment" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_project_manager_assignment_project" FOREIGN KEY ("project_id") REFERENCES "app"."project"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_project_manager_assignment_user" FOREIGN KEY ("user_id") REFERENCES "app"."app_user"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_project_manager_assignment" UNIQUE ("project_id", "user_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "app"."employee_manager_assignment" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "manager_id" uuid NOT NULL,
        "employee_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_employee_manager_assignment_company" FOREIGN KEY ("company_id") REFERENCES "app"."company"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_employee_manager_assignment_manager" FOREIGN KEY ("manager_id") REFERENCES "app"."app_user"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_employee_manager_assignment_employee" FOREIGN KEY ("employee_id") REFERENCES "app"."app_user"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_employee_manager_assignment" UNIQUE ("manager_id", "employee_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "app"."time_entry" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "company_id" uuid NOT NULL,
        "project_id" uuid NOT NULL,
        "work_date" date NOT NULL,
        "start_minute" smallint NOT NULL,
        "end_minute" smallint NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_time_entry_user" FOREIGN KEY ("user_id") REFERENCES "app"."app_user"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_time_entry_company" FOREIGN KEY ("company_id") REFERENCES "app"."company"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_time_entry_project" FOREIGN KEY ("project_id") REFERENCES "app"."project"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_time_entry_start" CHECK ("start_minute" >= 0 AND "start_minute" % 5 = 0),
        CONSTRAINT "CHK_time_entry_end" CHECK ("end_minute" <= 1440 AND "end_minute" % 5 = 0),
        CONSTRAINT "CHK_time_entry_order" CHECK ("end_minute" > "start_minute")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_time_entry_user_workdate" ON "app"."time_entry" ("user_id", "work_date")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "app"."time_entry"`);
    await queryRunner.query(`DROP TABLE "app"."employee_manager_assignment"`);
    await queryRunner.query(`DROP TABLE "app"."project_manager_assignment"`);
    await queryRunner.query(`DROP TABLE "app"."project_assignment"`);
    await queryRunner.query(`DROP TABLE "app"."project"`);
    await queryRunner.query(`DROP TABLE "app"."company_membership"`);
    await queryRunner.query(`DROP TABLE "app"."company"`);
    await queryRunner.query(`DROP TABLE "app"."app_user"`);
    await queryRunner.query(`DROP TYPE "app"."project_kind_enum"`);
    await queryRunner.query(`DROP TYPE "app"."company_role_enum"`);
    await queryRunner.query(`DROP TYPE "app"."user_status_enum"`);
  }
}
