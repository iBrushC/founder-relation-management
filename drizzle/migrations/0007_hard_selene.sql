CREATE TABLE "email_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"thread_id" text NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"snippet" text DEFAULT '' NOT NULL,
	"last_message_at" timestamp with time zone NOT NULL,
	"message_count" integer DEFAULT 1 NOT NULL,
	"direction" text DEFAULT 'both' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_threads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "alt_emails" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "google_accounts" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_threads_owner_id_idx" ON "email_threads" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "email_threads_connection_id_idx" ON "email_threads" USING btree ("connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_threads_owner_connection_thread_idx" ON "email_threads" USING btree ("owner_id","connection_id","thread_id");--> statement-breakpoint
CREATE POLICY "Owner can view own rows" ON "email_threads" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "email_threads"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can insert own rows" ON "email_threads" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "email_threads"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can update own rows" ON "email_threads" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "email_threads"."owner_id") WITH CHECK ((select auth.uid()) = "email_threads"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can delete own rows" ON "email_threads" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "email_threads"."owner_id");