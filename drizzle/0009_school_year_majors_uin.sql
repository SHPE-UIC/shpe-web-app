UPDATE "users" SET "school_level" = NULL WHERE "school_level" NOT IN ('1st','2nd','3rd','4th','5th','6th','Graduate','PhD','Other');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "school_level_other" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "majors" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "major_other" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "uin" text;--> statement-breakpoint
CREATE UNIQUE INDEX "users_uin_idx" ON "users" USING btree ("uin");