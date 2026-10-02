-- AlterTable
ALTER TABLE "invitation" ADD COLUMN IF NOT EXISTS "productIds" JSONB DEFAULT '[]';

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_product" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_product_userId_productId_key" ON "user_product"("userId", "productId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_product_tenantId_userId_idx" ON "user_product"("tenantId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_product_tenantId_productId_idx" ON "user_product"("tenantId", "productId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_product_tenantId_fkey'
    ) THEN
        ALTER TABLE "user_product" ADD CONSTRAINT "user_product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_product_userId_fkey'
    ) THEN
        ALTER TABLE "user_product" ADD CONSTRAINT "user_product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_product_productId_fkey'
    ) THEN
        ALTER TABLE "user_product" ADD CONSTRAINT "user_product_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
