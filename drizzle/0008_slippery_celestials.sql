CREATE TABLE "menu_add_on_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_add_on_items" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"name" text NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"price_minor_units" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "menu_add_on_groups" ADD CONSTRAINT "menu_add_on_groups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_add_on_items" ADD CONSTRAINT "menu_add_on_items_group_id_menu_add_on_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."menu_add_on_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "menu_add_on_groups_tenant_id_idx" ON "menu_add_on_groups" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_add_on_groups_tenant_name_unique_idx" ON "menu_add_on_groups" USING btree ("tenant_id",lower("name"));--> statement-breakpoint
CREATE INDEX "menu_add_on_items_group_id_idx" ON "menu_add_on_items" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_add_on_items_group_name_unique_idx" ON "menu_add_on_items" USING btree ("group_id",lower("name"));