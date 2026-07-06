ALTER TABLE "events" ADD COLUMN "link" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "hosted_by_me" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "invited_by_id" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_invited_by_id_connections_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_invited_by_id_idx" ON "events" USING btree ("invited_by_id");