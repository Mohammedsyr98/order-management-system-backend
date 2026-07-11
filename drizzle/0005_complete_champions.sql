CREATE TABLE "menu_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "menu_categories_tenant_id_idx" ON "menu_categories" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_categories_tenant_name_unique_idx" ON "menu_categories" USING btree ("tenant_id",lower("name"));