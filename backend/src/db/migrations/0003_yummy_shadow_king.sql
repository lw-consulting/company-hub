CREATE TABLE "chat_message_receipts" (
	"message_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	CONSTRAINT "chat_message_receipts_message_id_recipient_id_pk" PRIMARY KEY("message_id","recipient_id")
);
--> statement-breakpoint
ALTER TABLE "chat_message_receipts" ADD CONSTRAINT "chat_message_receipts_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_receipts" ADD CONSTRAINT "chat_message_receipts_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chat_receipts_recipient" ON "chat_message_receipts" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "idx_chat_receipts_message" ON "chat_message_receipts" USING btree ("message_id");