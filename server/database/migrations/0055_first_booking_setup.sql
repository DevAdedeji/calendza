CREATE TABLE "booking_setups" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"event_type_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_setups_status_allowed" CHECK ("booking_setups"."status" in ('pending', 'skipped', 'completed'))
);
--> statement-breakpoint
ALTER TABLE "booking_setups" ADD CONSTRAINT "booking_setups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_setups" ADD CONSTRAINT "booking_setups_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_setups_event_type_key" ON "booking_setups" USING btree ("event_type_id");