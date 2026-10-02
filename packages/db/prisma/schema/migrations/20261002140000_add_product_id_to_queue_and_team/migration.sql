-- AlterTable
ALTER TABLE "team" ADD COLUMN IF NOT EXISTS "productId" UUID;

-- AlterTable
ALTER TABLE "queue" ADD COLUMN IF NOT EXISTS "productId" UUID;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "team_tenantId_productId_idx" ON "team"("tenantId", "productId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "queue_tenantId_productId_idx" ON "queue"("tenantId", "productId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'team_productId_fkey'
    ) THEN
        ALTER TABLE "team" ADD CONSTRAINT "team_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'queue_productId_fkey'
    ) THEN
        ALTER TABLE "queue" ADD CONSTRAINT "queue_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
