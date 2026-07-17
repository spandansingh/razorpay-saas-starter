CREATE TABLE "billing_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"org_id" text,
	"plan_id" text,
	"amount" integer,
	"currency" text,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_event_provider_event_id_key" UNIQUE("provider","event_id")
);
--> statement-breakpoint
CREATE INDEX "billing_event_org_id_idx" ON "billing_event" USING btree ("org_id");