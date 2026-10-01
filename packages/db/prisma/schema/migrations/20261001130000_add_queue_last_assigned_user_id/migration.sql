-- AlterTable
ALTER TABLE "queue" ADD COLUMN IF NOT EXISTS "lastAssignedUserId" UUID;
