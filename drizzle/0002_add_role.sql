ALTER TABLE "users" ADD COLUMN "role" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Carry the old boolean across before it is dropped in the next migration.
-- Everyone who was an officer becomes a board member (1). Nobody is made a
-- top 8 (2) automatically: the first one is created by hand, the same
-- bootstrap the first officer needed. See docs/PERMISSIONS.md.
UPDATE "users" SET "role" = 1 WHERE "is_admin" = true;
