-- Drop old tenant-wide single default queue unique index
DROP INDEX IF EXISTS "queue_single_default_per_tenant";

-- Create product-scoped single default queue unique index (one default per product per tenant)
CREATE UNIQUE INDEX IF NOT EXISTS "queue_single_default_per_product"
  ON public.queue ("tenantId", "productId")
  WHERE "isDefault" AND "productId" IS NOT NULL;
