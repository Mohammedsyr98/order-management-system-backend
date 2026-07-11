CREATE TABLE IF NOT EXISTS "menu_products" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_available" boolean DEFAULT true NOT NULL,
	"price_minor_units" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'menu_products_category_id_menu_categories_id_fk'
	) THEN
		ALTER TABLE "menu_products" ADD CONSTRAINT "menu_products_category_id_menu_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."menu_categories"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menu_products_category_id_idx" ON "menu_products" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "menu_products_category_name_unique_idx" ON "menu_products" USING btree ("category_id",lower("name"));
