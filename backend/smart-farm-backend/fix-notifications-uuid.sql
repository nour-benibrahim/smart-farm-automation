-- Fix notifications table UUID issue
-- This script updates the existing notifications table to use proper UUID generation

-- First, enable the uuid-ossp extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Update the notifications table to use proper UUID type and default
ALTER TABLE "notifications" 
ALTER COLUMN "id" TYPE uuid USING "id"::uuid,
ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- If the above doesn't work, we can try this alternative approach:
-- ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_pkey";
-- ALTER TABLE "notifications" DROP COLUMN IF EXISTS "id";
-- ALTER TABLE "notifications" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid();

-- Verify the change
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'notifications' AND column_name = 'id';
