CREATE TABLE "subscription" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"mode" text NOT NULL,
	"status" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_external_id_unique" UNIQUE("external_id")
);
