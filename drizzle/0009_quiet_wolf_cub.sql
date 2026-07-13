CREATE TABLE "menu_product_add_on_groups" (
	"product_id" text NOT NULL,
	"add_on_group_id" text NOT NULL,
	CONSTRAINT "menu_product_add_on_groups_pk" PRIMARY KEY("product_id","add_on_group_id")
);
--> statement-breakpoint
ALTER TABLE "menu_product_add_on_groups" ADD CONSTRAINT "menu_product_add_on_groups_product_id_menu_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."menu_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_product_add_on_groups" ADD CONSTRAINT "menu_product_add_on_groups_add_on_group_id_menu_add_on_groups_id_fk" FOREIGN KEY ("add_on_group_id") REFERENCES "public"."menu_add_on_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "menu_product_add_on_groups_add_on_group_id_idx" ON "menu_product_add_on_groups" USING btree ("add_on_group_id");