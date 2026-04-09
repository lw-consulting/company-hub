CREATE TABLE "notification_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"platform" varchar(20) NOT NULL,
	"endpoint" text NOT NULL,
	"subscription" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"user_agent" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notification_preferences" jsonb DEFAULT '{"chat":{"inApp":true,"email":false,"push":true},"community":{"inApp":true,"email":false,"push":false},"tasks":{"inApp":true,"email":true,"push":true},"calendar":{"inApp":true,"email":true,"push":true},"leave":{"inApp":true,"email":true,"push":true},"time_tracking":{"inApp":true,"email":true,"push":false},"ai_assistants":{"inApp":true,"email":false,"push":false},"system":{"inApp":true,"email":true,"push":true}}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_devices" ADD CONSTRAINT "notification_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_devices" ADD CONSTRAINT "notification_devices_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notification_devices_user" ON "notification_devices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notification_devices_org" ON "notification_devices" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_notification_devices_platform" ON "notification_devices" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "idx_notification_devices_enabled" ON "notification_devices" USING btree ("user_id","enabled");