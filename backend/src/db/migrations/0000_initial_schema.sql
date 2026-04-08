CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_assistant_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assistant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_assistants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"avatar_url" text,
	"model" varchar(100) NOT NULL,
	"system_prompt" text,
	"temperature" numeric(3, 2) DEFAULT '0.70',
	"max_tokens" integer DEFAULT 2048,
	"tone" varchar(50) DEFAULT 'professional',
	"language" varchar(10) DEFAULT 'de',
	"opening_message" text,
	"forbidden_topics" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"token_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assistant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(300),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(30) NOT NULL,
	"api_key_encrypted" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" varchar(12) NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendar_event_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"location" varchar(300),
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"recurrence_rule" text,
	"color" varchar(7),
	"visibility" varchar(20) DEFAULT 'private' NOT NULL,
	"source_type" varchar(30) DEFAULT 'manual' NOT NULL,
	"source_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"content" text NOT NULL,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_id" uuid NOT NULL,
	"following_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_forum_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"icon" varchar(50),
	"color" varchar(7) DEFAULT '#6366f1',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_forums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"icon" varchar(50),
	"is_announcement" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"post_count" integer DEFAULT 0 NOT NULL,
	"last_post_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"post_id" uuid,
	"comment_id" uuid,
	"reaction_type" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_poll_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"text" varchar(300) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_poll_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"option_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"question" text NOT NULL,
	"multiple_choice" boolean DEFAULT false NOT NULL,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"forum_id" uuid,
	"author_id" uuid NOT NULL,
	"content" text NOT NULL,
	"post_type" varchar(20) DEFAULT 'post' NOT NULL,
	"background" varchar(50),
	"media_urls" jsonb DEFAULT '[]'::jsonb,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"bio" text,
	"headline" varchar(200),
	"social_links" jsonb DEFAULT '{}'::jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "course_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "course_lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"title" varchar(300) NOT NULL,
	"content_type" varchar(20) DEFAULT 'text' NOT NULL,
	"text_content" text,
	"video_url" text,
	"video_duration_seconds" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "course_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"thumbnail_url" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crm_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"type" varchar(30) NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"contact_id" uuid,
	"deal_id" uuid,
	"company_id" uuid,
	"created_by" uuid NOT NULL,
	"activity_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crm_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(300) NOT NULL,
	"website" varchar(500),
	"industry" varchar(100),
	"size" varchar(50),
	"address" text,
	"phone" varchar(50),
	"notes" text,
	"owner_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crm_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"position" varchar(100),
	"company_id" uuid,
	"notes" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"owner_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crm_deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"title" varchar(300) NOT NULL,
	"value" numeric(12, 2),
	"currency" varchar(3) DEFAULT 'EUR',
	"stage" varchar(50) DEFAULT 'lead' NOT NULL,
	"probability" integer DEFAULT 0,
	"contact_id" uuid,
	"company_id" uuid,
	"owner_id" uuid,
	"expected_close_date" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "file_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"filename" varchar(500) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"half_day_start" boolean DEFAULT false NOT NULL,
	"half_day_end" boolean DEFAULT false NOT NULL,
	"business_days" integer NOT NULL,
	"reason" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leave_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(7) DEFAULT '#6366f1' NOT NULL,
	"deducts_vacation" boolean DEFAULT true NOT NULL,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lesson_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"module_id" varchar(50),
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"logo_url" text,
	"primary_color" varchar(7) DEFAULT '#6366f1' NOT NULL,
	"secondary_color" varchar(7) DEFAULT '#1e1b4b' NOT NULL,
	"accent_color" varchar(7) DEFAULT '#f59e0b' NOT NULL,
	"timezone" varchar(50) DEFAULT 'Europe/Vienna' NOT NULL,
	"locale" varchar(5) DEFAULT 'de' NOT NULL,
	"core_hours_start" varchar(5),
	"core_hours_end" varchar(5),
	"break_after_minutes" integer DEFAULT 360 NOT NULL,
	"break_duration_minutes" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "public_holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"date" date NOT NULL,
	"name" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"created_by" uuid NOT NULL,
	"assigned_to" uuid,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"clock_in" timestamp with time zone NOT NULL,
	"clock_out" timestamp with time zone,
	"break_minutes" integer DEFAULT 0 NOT NULL,
	"auto_break_applied" boolean DEFAULT false NOT NULL,
	"notes" text,
	"corrected_by" uuid,
	"correction_note" text,
	"user_edited" boolean DEFAULT false NOT NULL,
	"user_edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_module_permissions" (
	"user_id" uuid NOT NULL,
	"module_id" varchar(50) NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"granted_by" uuid,
	CONSTRAINT "user_module_permissions_user_id_module_id_pk" PRIMARY KEY("user_id","module_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"avatar_url" text,
	"department" varchar(100),
	"position" varchar(100),
	"phone" varchar(50),
	"supervisor_id" uuid,
	"org_id" uuid NOT NULL,
	"vacation_days_per_year" integer DEFAULT 25 NOT NULL,
	"weekly_target_hours" numeric(5, 2) DEFAULT '40.00' NOT NULL,
	"initial_balance_minutes" integer DEFAULT 0 NOT NULL,
	"working_days" jsonb DEFAULT '[1,2,3,4,5]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"refresh_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"event" varchar(100) NOT NULL,
	"payload" jsonb,
	"status_code" varchar(5),
	"response_body" text,
	"success" boolean DEFAULT false NOT NULL,
	"delivered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"url" text NOT NULL,
	"secret_encrypted" text NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"fail_count" varchar(10) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ai_assistant_assignments" ADD CONSTRAINT "ai_assistant_assignments_assistant_id_ai_assistants_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "public"."ai_assistants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ai_assistant_assignments" ADD CONSTRAINT "ai_assistant_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ai_assistants" ADD CONSTRAINT "ai_assistants_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ai_assistants" ADD CONSTRAINT "ai_assistants_provider_id_ai_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_session_id_ai_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."ai_chat_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ai_chat_sessions" ADD CONSTRAINT "ai_chat_sessions_assistant_id_ai_assistants_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "public"."ai_assistants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ai_chat_sessions" ADD CONSTRAINT "ai_chat_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ai_providers" ADD CONSTRAINT "ai_providers_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "calendar_event_attendees" ADD CONSTRAINT "calendar_event_attendees_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "calendar_event_attendees" ADD CONSTRAINT "calendar_event_attendees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "community_bookmarks" ADD CONSTRAINT "community_bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "community_bookmarks" ADD CONSTRAINT "community_bookmarks_post_id_community_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_post_id_community_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "community_follows" ADD CONSTRAINT "community_follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "community_follows" ADD CONSTRAINT "community_follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "community_forum_groups" ADD CONSTRAINT "community_forum_groups_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "community_forums" ADD CONSTRAINT "community_forums_group_id_community_forum_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."community_forum_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "community_forums" ADD CONSTRAINT "community_forums_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "community_reactions" ADD CONSTRAINT "community_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "community_reactions" ADD CONSTRAINT "community_reactions_post_id_community_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "community_reactions" ADD CONSTRAINT "community_reactions_comment_id_community_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."community_comments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "community_poll_options" ADD CONSTRAINT "community_poll_options_poll_id_community_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."community_polls"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "community_poll_votes" ADD CONSTRAINT "community_poll_votes_option_id_community_poll_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."community_poll_options"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "community_poll_votes" ADD CONSTRAINT "community_poll_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "community_polls" ADD CONSTRAINT "community_polls_post_id_community_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_forum_id_community_forums_id_fk" FOREIGN KEY ("forum_id") REFERENCES "public"."community_forums"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "community_profiles" ADD CONSTRAINT "community_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_module_id_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "courses" ADD CONSTRAINT "courses_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_deal_id_crm_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."crm_deals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_company_id_crm_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."crm_companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "crm_companies" ADD CONSTRAINT "crm_companies_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "crm_companies" ADD CONSTRAINT "crm_companies_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_company_id_crm_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."crm_companies"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_company_id_crm_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."crm_companies"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_course_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."course_lessons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "public_holidays" ADD CONSTRAINT "public_holidays_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_corrected_by_users_id_fk" FOREIGN KEY ("corrected_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_module_permissions" ADD CONSTRAINT "user_module_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_module_permissions" ADD CONSTRAINT "user_module_permissions_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_supervisor_id_users_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ai_assignments_user" ON "ai_assistant_assignments" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ai_assistants_org" ON "ai_assistants" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ai_assistants_slug" ON "ai_assistants" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ai_messages_session" ON "ai_chat_messages" USING btree ("session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ai_sessions_user" ON "ai_chat_sessions" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ai_sessions_assistant" ON "ai_chat_sessions" USING btree ("assistant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_api_keys_org" ON "api_keys" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_api_keys_prefix" ON "api_keys" USING btree ("key_prefix");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cal_attendees_event" ON "calendar_event_attendees" USING btree ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cal_attendees_user" ON "calendar_event_attendees" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_calendar_events_org" ON "calendar_events" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_calendar_events_dates" ON "calendar_events" USING btree ("start_at","end_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_calendar_events_creator" ON "calendar_events" USING btree ("created_by");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_calendar_events_source" ON "calendar_events" USING btree ("source_type","source_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bookmarks_user" ON "community_bookmarks" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bookmarks_user_post" ON "community_bookmarks" USING btree ("user_id","post_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_community_comments_post" ON "community_comments" USING btree ("post_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_follows_follower" ON "community_follows" USING btree ("follower_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_follows_following" ON "community_follows" USING btree ("following_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_forum_groups_org" ON "community_forum_groups" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_forums_group" ON "community_forums" USING btree ("group_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_forums_org" ON "community_forums" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reactions_post" ON "community_reactions" USING btree ("post_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reactions_user" ON "community_reactions" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reactions_post_user" ON "community_reactions" USING btree ("post_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_poll_options_poll" ON "community_poll_options" USING btree ("poll_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_poll_votes_option" ON "community_poll_votes" USING btree ("option_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_poll_votes_user" ON "community_poll_votes" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_poll_votes_option_user" ON "community_poll_votes" USING btree ("option_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_polls_post" ON "community_polls" USING btree ("post_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_community_posts_org" ON "community_posts" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_community_posts_forum" ON "community_posts" USING btree ("forum_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_community_posts_author" ON "community_posts" USING btree ("author_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_community_posts_created" ON "community_posts" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_enrollments_user" ON "course_enrollments" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_enrollments_course" ON "course_enrollments" USING btree ("course_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_course_lessons_module" ON "course_lessons" USING btree ("module_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_course_modules_course" ON "course_modules" USING btree ("course_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_courses_org" ON "courses" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_crm_activities_contact" ON "crm_activities" USING btree ("contact_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_crm_activities_deal" ON "crm_activities" USING btree ("deal_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_crm_companies_org" ON "crm_companies" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_crm_contacts_org" ON "crm_contacts" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_crm_contacts_company" ON "crm_contacts" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_crm_deals_org" ON "crm_deals" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_crm_deals_stage" ON "crm_deals" USING btree ("stage");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_crm_deals_owner" ON "crm_deals" USING btree ("owner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_uploads_entity" ON "file_uploads" USING btree ("entity_type","entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_uploads_user" ON "file_uploads" USING btree ("uploaded_by");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_leave_requests_user" ON "leave_requests" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_leave_requests_status" ON "leave_requests" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_leave_requests_dates" ON "leave_requests" USING btree ("start_date","end_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lesson_progress_user" ON "lesson_progress" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lesson_progress_lesson" ON "lesson_progress" USING btree ("lesson_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_user" ON "notifications" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_unread" ON "notifications" USING btree ("user_id","is_read");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_public_holidays_org_date" ON "public_holidays" USING btree ("org_id","date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_task_comments_task" ON "task_comments" USING btree ("task_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_org" ON "tasks" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_assigned" ON "tasks" USING btree ("assigned_to");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_status" ON "tasks" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_due" ON "tasks" USING btree ("due_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_time_entries_user_date" ON "time_entries" USING btree ("user_id","clock_in");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_time_entries_org" ON "time_entries" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users" USING btree ("email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_org" ON "users" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_supervisor" ON "users" USING btree ("supervisor_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_deliveries_webhook" ON "webhook_deliveries" USING btree ("webhook_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhooks_org" ON "webhooks" USING btree ("org_id");
