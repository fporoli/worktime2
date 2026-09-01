import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserLocale1700000100000 implements MigrationInterface {
  name = 'AddUserLocale1700000100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "app"."locale_enum" AS ENUM ('en', 'de', 'fr')`);
    await queryRunner.query(
      `ALTER TABLE "app"."app_user" ADD "locale" "app"."locale_enum" NOT NULL DEFAULT 'en'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "app"."app_user" DROP COLUMN "locale"`);
    await queryRunner.query(`DROP TYPE "app"."locale_enum"`);
  }
}
