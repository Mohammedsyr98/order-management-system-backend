CREATE TYPE "public"."menu_product_pricing_mode" AS ENUM('fixed', 'priced_by_choice');--> statement-breakpoint
CREATE TABLE "menu_product_pricing_choices" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"name" text NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"price_minor_units" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "menu_products" ALTER COLUMN "price_minor_units" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_products" ADD COLUMN "pricing_mode" "menu_product_pricing_mode" DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_product_pricing_choices" ADD CONSTRAINT "menu_product_pricing_choices_product_id_menu_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."menu_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "menu_product_pricing_choices_product_id_idx" ON "menu_product_pricing_choices" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_product_pricing_choices_product_name_unique_idx" ON "menu_product_pricing_choices" USING btree ("product_id",lower("name"));