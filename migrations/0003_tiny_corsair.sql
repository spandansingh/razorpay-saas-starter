-- Two-step so the column can be added NOT NULL to a table that already has rows:
-- existing todos get '' (never a valid Clerk org id, so they stay invisible to
-- every org-scoped query), then the default is dropped so new inserts must supply one.
ALTER TABLE "todo" ADD COLUMN "org_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "todo" ALTER COLUMN "org_id" DROP DEFAULT;--> statement-breakpoint
CREATE INDEX "todo_org_id_idx" ON "todo" USING btree ("org_id");