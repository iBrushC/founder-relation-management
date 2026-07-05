CREATE TABLE "project_outreach" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"connection_id" uuid,
	"label" text NOT NULL,
	"channel" text,
	"status" text DEFAULT 'Not started' NOT NULL,
	"last_contacted" date,
	"follow_up_at" date,
	"notes" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_outreach" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_outreach" ADD CONSTRAINT "project_outreach_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_outreach" ADD CONSTRAINT "project_outreach_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_outreach" ADD CONSTRAINT "project_outreach_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_outreach_owner_id_idx" ON "project_outreach" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "project_outreach_project_id_idx" ON "project_outreach" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_outreach_connection_id_idx" ON "project_outreach" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "project_outreach_follow_up_at_idx" ON "project_outreach" USING btree ("follow_up_at");--> statement-breakpoint
CREATE POLICY "Owner can view own rows" ON "project_outreach" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "project_outreach"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can insert own rows" ON "project_outreach" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "project_outreach"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can update own rows" ON "project_outreach" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "project_outreach"."owner_id") WITH CHECK ((select auth.uid()) = "project_outreach"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can delete own rows" ON "project_outreach" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "project_outreach"."owner_id");