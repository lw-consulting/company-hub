CREATE TABLE "time_entry_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"time_entry_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"supervisor_id" uuid,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"requested_change" jsonb NOT NULL,
	"decision_note" text,
	"decided_at" timestamp with time zone,
	"decided_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "time_edits_require_approval" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "time_entry_change_requests" ADD CONSTRAINT "time_entry_change_requests_time_entry_id_time_entries_id_fk" FOREIGN KEY ("time_entry_id") REFERENCES "public"."time_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry_change_requests" ADD CONSTRAINT "time_entry_change_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry_change_requests" ADD CONSTRAINT "time_entry_change_requests_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry_change_requests" ADD CONSTRAINT "time_entry_change_requests_supervisor_id_users_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry_change_requests" ADD CONSTRAINT "time_entry_change_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_time_entry_change_requests_user" ON "time_entry_change_requests" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_time_entry_change_requests_supervisor" ON "time_entry_change_requests" USING btree ("supervisor_id","status","created_at");