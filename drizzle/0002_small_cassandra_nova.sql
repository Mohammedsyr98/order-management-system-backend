ALTER TABLE "tenants" ADD COLUMN "phone" text;
--> statement-breakpoint
UPDATE "tenants" SET "phone" = '' WHERE "phone" IS NULL;
--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "phone" SET NOT NULL;
