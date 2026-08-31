UPDATE "users" SET "gender" = NULL WHERE "gender" NOT IN ('Male','Female','Other');--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "age";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "sex_at_birth";
