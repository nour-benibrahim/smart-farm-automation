import { MigrationInterface, QueryRunner } from "typeorm";

export class FixActionLogsPrimaryKey1738123456791 implements MigrationInterface {
    name = 'FixActionLogsPrimaryKey1738123456791'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Fix the action_logs table primary key
        await queryRunner.query(`ALTER TABLE "action_logs" DROP CONSTRAINT IF EXISTS "action_logs_pkey"`);
        await queryRunner.query(`ALTER TABLE "action_logs" DROP COLUMN IF EXISTS "id"`);
        await queryRunner.query(`ALTER TABLE "action_logs" ADD "id" SERIAL PRIMARY KEY`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert the action_logs table primary key
        await queryRunner.query(`ALTER TABLE "action_logs" DROP CONSTRAINT IF EXISTS "action_logs_pkey"`);
        await queryRunner.query(`ALTER TABLE "action_logs" DROP COLUMN IF EXISTS "id"`);
        await queryRunner.query(`ALTER TABLE "action_logs" ADD "id" varchar(36) PRIMARY KEY`);
    }
}
