CREATE TABLE "ai_assistant_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assistant_id" uuid NOT NULL,
	"filename" varchar(500) NOT NULL,
	"file_type" varchar(30) NOT NULL,
	"mime_type" varchar(150),
	"file_size" integer NOT NULL,
	"text_content" text NOT NULL,
	"include_in_prompt" boolean DEFAULT true NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"assistant_id" uuid NOT NULL,
	"content" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_assistant_assignments" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_assistants" ADD COLUMN "top_p" numeric(3, 2) DEFAULT '1.00';--> statement-breakpoint
ALTER TABLE "ai_assistants" ADD COLUMN "response_structure" text;--> statement-breakpoint
ALTER TABLE "ai_chat_messages" ADD COLUMN "model_used" varchar(100);--> statement-breakpoint
ALTER TABLE "ai_chat_messages" ADD COLUMN "latency_ms" integer;--> statement-breakpoint
ALTER TABLE "ai_assistant_documents" ADD CONSTRAINT "ai_assistant_documents_assistant_id_ai_assistants_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "public"."ai_assistants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_assistant_documents" ADD CONSTRAINT "ai_assistant_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_document_chunks" ADD CONSTRAINT "ai_document_chunks_document_id_ai_assistant_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."ai_assistant_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_document_chunks" ADD CONSTRAINT "ai_document_chunks_assistant_id_ai_assistants_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "public"."ai_assistants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ai_documents_assistant" ON "ai_assistant_documents" USING btree ("assistant_id");--> statement-breakpoint
CREATE INDEX "idx_ai_document_chunks_assistant" ON "ai_document_chunks" USING btree ("assistant_id");--> statement-breakpoint
CREATE INDEX "idx_ai_document_chunks_document" ON "ai_document_chunks" USING btree ("document_id");