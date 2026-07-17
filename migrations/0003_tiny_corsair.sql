ALTER TABLE "todo" ADD COLUMN "org_id" text NOT NULL;--> statement-breakpoint
CREATE INDEX "todo_org_id_idx" ON "todo" USING btree ("org_id");