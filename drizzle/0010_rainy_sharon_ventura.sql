DO $$ BEGIN
	IF EXISTS (
		SELECT 1
		FROM "menu_products"
		WHERE (
			"pricing_mode" = 'fixed'
			AND ("price_minor_units" IS NULL OR "price_minor_units" < 0)
		)
		OR (
			"pricing_mode" = 'priced_by_choice'
			AND "price_minor_units" IS NOT NULL
		)
	) THEN
		RAISE EXCEPTION 'Cannot add menu_products_pricing_mode_price_check because menu_products contains invalid pricing data.';
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "menu_products" ADD CONSTRAINT "menu_products_pricing_mode_price_check" CHECK ((
        ("menu_products"."pricing_mode" = 'fixed' AND "menu_products"."price_minor_units" IS NOT NULL AND "menu_products"."price_minor_units" >= 0)
        OR ("menu_products"."pricing_mode" = 'priced_by_choice' AND "menu_products"."price_minor_units" IS NULL)
      ));
