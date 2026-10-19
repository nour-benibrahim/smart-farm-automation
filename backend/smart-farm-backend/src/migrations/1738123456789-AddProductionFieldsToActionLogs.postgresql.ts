import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProductionFieldsToActionLogs1738123456789 implements MigrationInterface {
    name = 'AddProductionFieldsToActionLogs1738123456789'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add new production-ready columns to action_logs table
        await queryRunner.query(`
            ALTER TABLE "action_logs" 
            ADD COLUMN IF NOT EXISTS "action_id" varchar(100) NULL,
            ADD COLUMN IF NOT EXISTS "action_type" varchar(20) NULL,
            ADD COLUMN IF NOT EXISTS "qos_level" int NULL,
            ADD COLUMN IF NOT EXISTS "retain_flag" boolean NULL,
            ADD COLUMN IF NOT EXISTS "sent_at" timestamp NULL,
            ADD COLUMN IF NOT EXISTS "ack_at" timestamp NULL,
            ADD COLUMN IF NOT EXISTS "timeout_at" timestamp NULL,
            ADD COLUMN IF NOT EXISTS "failed_at" timestamp NULL,
            ADD COLUMN IF NOT EXISTS "retry_count" int NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "max_retries" int NOT NULL DEFAULT 1
        `);

        // Add index on action_id for better performance
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_action_logs_action_id" ON "action_logs" ("action_id")
        `);

        // Note: action_logs.status uses varchar in the entity; no enum alteration needed
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove the index
        await queryRunner.query(`
            DROP INDEX "IDX_action_logs_action_id"
        `);

        // Remove the new columns
        await queryRunner.query(`
            ALTER TABLE "action_logs" 
            DROP COLUMN "action_id",
            DROP COLUMN "action_type",
            DROP COLUMN "qos_level",
            DROP COLUMN "retain_flag",
            DROP COLUMN "sent_at",
            DROP COLUMN "ack_at",
            DROP COLUMN "timeout_at",
            DROP COLUMN "failed_at",
            DROP COLUMN "retry_count",
            DROP COLUMN "max_retries"
        `);

        // Note: PostgreSQL doesn't support removing enum values easily
        // The enum values will remain but won't be used
    }
}
