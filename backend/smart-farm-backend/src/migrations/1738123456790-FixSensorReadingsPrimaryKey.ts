import { MigrationInterface, QueryRunner } from "typeorm";

export class FixSensorReadingsPrimaryKey1738123456790 implements MigrationInterface {
    name = 'FixSensorReadingsPrimaryKey1738123456790'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // First, let's check what constraints exist and drop them safely
        const constraints = await queryRunner.query(`
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'sensor_readings' 
            AND constraint_type = 'PRIMARY KEY'
        `);
        
        // Drop existing primary key constraint if it exists
        if (constraints.length > 0) {
            const constraintName = constraints[0].constraint_name;
            await queryRunner.query(`ALTER TABLE "sensor_readings" DROP CONSTRAINT "${constraintName}"`);
        }
        
        // Drop the existing id column if it exists
        await queryRunner.query(`ALTER TABLE "sensor_readings" DROP COLUMN IF EXISTS "id"`);
        
        // Add new id column as serial (auto-incrementing integer)
        await queryRunner.query(`ALTER TABLE "sensor_readings" ADD "id" SERIAL NOT NULL`);
        
        // Set the new id column as primary key
        await queryRunner.query(`ALTER TABLE "sensor_readings" ADD CONSTRAINT "PK_sensor_readings" PRIMARY KEY ("id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the primary key constraint
        await queryRunner.query(`ALTER TABLE "sensor_readings" DROP CONSTRAINT IF EXISTS "PK_sensor_readings"`);
        
        // Drop the id column
        await queryRunner.query(`ALTER TABLE "sensor_readings" DROP COLUMN IF EXISTS "id"`);
        
        // Add back the uuid id column (requires uuid-ossp extension)
        await queryRunner.query(`ALTER TABLE "sensor_readings" ADD "id" uuid NOT NULL DEFAULT gen_random_uuid()`);
        
        // Set the uuid id column as primary key
        await queryRunner.query(`ALTER TABLE "sensor_readings" ADD CONSTRAINT "PK_sensor_readings" PRIMARY KEY ("id")`);
    }
}
