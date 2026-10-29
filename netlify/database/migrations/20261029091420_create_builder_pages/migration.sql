CREATE TABLE "builder_pages" (
	"id" text PRIMARY KEY,
	"draft" jsonb NOT NULL,
	"published" jsonb,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
