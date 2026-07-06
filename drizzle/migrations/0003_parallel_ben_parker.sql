ALTER TABLE "connections" ADD COLUMN "linkedin" text;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "extra_fields" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "project_outreach" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "project_outreach" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "project_outreach" ADD COLUMN "website" text;