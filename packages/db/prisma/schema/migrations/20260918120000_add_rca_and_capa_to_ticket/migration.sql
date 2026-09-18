-- AlterEnum
ALTER TYPE "RoleKey" ADD VALUE IF NOT EXISTS 'DEVOPS_TEAM';
ALTER TYPE "SupportTier" ADD VALUE IF NOT EXISTS 'DEVOPS';

-- AlterTable
ALTER TABLE "ticket" ADD COLUMN IF NOT EXISTS "rootCause" TEXT;
ALTER TABLE "ticket" ADD COLUMN IF NOT EXISTS "capaNotes" TEXT;
ALTER TABLE "ticket" ADD COLUMN IF NOT EXISTS "rcaUpdatedAt" TIMESTAMPTZ(6);
ALTER TABLE "ticket" ADD COLUMN IF NOT EXISTS "capaUpdatedAt" TIMESTAMPTZ(6);
ALTER TABLE "ticket" ADD COLUMN IF NOT EXISTS "rcaUpdatedById" UUID;
ALTER TABLE "ticket" ADD COLUMN IF NOT EXISTS "capaUpdatedById" UUID;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ticket_rcaUpdatedById_fkey'
    ) THEN
        ALTER TABLE "ticket" ADD CONSTRAINT "ticket_rcaUpdatedById_fkey" FOREIGN KEY ("rcaUpdatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ticket_capaUpdatedById_fkey'
    ) THEN
        ALTER TABLE "ticket" ADD CONSTRAINT "ticket_capaUpdatedById_fkey" FOREIGN KEY ("capaUpdatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
