CREATE TYPE "public"."event_category" AS ENUM('mixer', 'demo_day', 'meetup', 'meeting', 'check_in', 'milestone', 'info_session', 'other');--> statement-breakpoint
CREATE TYPE "public"."tone" AS ENUM('red', 'amber', 'blue', 'green', 'purple', 'teal', 'slate');--> statement-breakpoint
CREATE TABLE "connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"company" text,
	"avatar_tone" "tone" DEFAULT 'slate' NOT NULL,
	"email" text,
	"phone" text,
	"location" text,
	"birthday" date,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"interactions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "event_participants" (
	"owner_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_participants_event_id_connection_id_pk" PRIMARY KEY("event_id","connection_id")
);
--> statement-breakpoint
ALTER TABLE "event_participants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" "event_category" DEFAULT 'other' NOT NULL,
	"event_date" date NOT NULL,
	"start_time" time,
	"location" text,
	"organizers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"met_guests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"project_id" uuid,
	"note" text,
	"avatar_tone" "tone" DEFAULT 'slate' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "project_participants" (
	"owner_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_participants_project_id_connection_id_pk" PRIMARY KEY("project_id","connection_id")
);
--> statement-breakpoint
ALTER TABLE "project_participants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "project_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"label" text NOT NULL,
	"tone" "tone" DEFAULT 'slate' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_stages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "project_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"connection_id" uuid,
	"label" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"due_date" date,
	"description" text,
	"subtasks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT 'folder' NOT NULL,
	"tone" "tone" DEFAULT 'slate' NOT NULL,
	"summary" text,
	"description" text,
	"status_label" text,
	"status_tone" "tone" DEFAULT 'slate' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_participants" ADD CONSTRAINT "project_participants_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_participants" ADD CONSTRAINT "project_participants_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_participants" ADD CONSTRAINT "project_participants_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_stages" ADD CONSTRAINT "project_stages_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_stages" ADD CONSTRAINT "project_stages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connections_owner_id_idx" ON "connections" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "connections_birthday_idx" ON "connections" USING btree ("birthday");--> statement-breakpoint
CREATE INDEX "event_participants_owner_id_idx" ON "event_participants" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "event_participants_connection_id_idx" ON "event_participants" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "events_owner_id_idx" ON "events" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "events_event_date_idx" ON "events" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "events_project_id_idx" ON "events" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_participants_owner_id_idx" ON "project_participants" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "project_participants_connection_id_idx" ON "project_participants" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "project_stages_owner_id_idx" ON "project_stages" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "project_stages_project_id_idx" ON "project_stages" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_tasks_owner_id_idx" ON "project_tasks" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "project_tasks_project_id_idx" ON "project_tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_tasks_due_date_idx" ON "project_tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "projects_owner_id_idx" ON "projects" USING btree ("owner_id");--> statement-breakpoint
CREATE POLICY "Owner can view own rows" ON "connections" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "connections"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can insert own rows" ON "connections" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "connections"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can update own rows" ON "connections" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "connections"."owner_id") WITH CHECK ((select auth.uid()) = "connections"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can delete own rows" ON "connections" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "connections"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can view own rows" ON "event_participants" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "event_participants"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can insert own rows" ON "event_participants" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "event_participants"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can update own rows" ON "event_participants" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "event_participants"."owner_id") WITH CHECK ((select auth.uid()) = "event_participants"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can delete own rows" ON "event_participants" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "event_participants"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can view own rows" ON "events" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "events"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can insert own rows" ON "events" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "events"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can update own rows" ON "events" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "events"."owner_id") WITH CHECK ((select auth.uid()) = "events"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can delete own rows" ON "events" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "events"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can view own rows" ON "project_participants" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "project_participants"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can insert own rows" ON "project_participants" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "project_participants"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can update own rows" ON "project_participants" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "project_participants"."owner_id") WITH CHECK ((select auth.uid()) = "project_participants"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can delete own rows" ON "project_participants" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "project_participants"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can view own rows" ON "project_stages" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "project_stages"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can insert own rows" ON "project_stages" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "project_stages"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can update own rows" ON "project_stages" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "project_stages"."owner_id") WITH CHECK ((select auth.uid()) = "project_stages"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can delete own rows" ON "project_stages" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "project_stages"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can view own rows" ON "project_tasks" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "project_tasks"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can insert own rows" ON "project_tasks" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "project_tasks"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can update own rows" ON "project_tasks" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "project_tasks"."owner_id") WITH CHECK ((select auth.uid()) = "project_tasks"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can delete own rows" ON "project_tasks" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "project_tasks"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can view own rows" ON "projects" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "projects"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can insert own rows" ON "projects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "projects"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can update own rows" ON "projects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "projects"."owner_id") WITH CHECK ((select auth.uid()) = "projects"."owner_id");--> statement-breakpoint
CREATE POLICY "Owner can delete own rows" ON "projects" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "projects"."owner_id");