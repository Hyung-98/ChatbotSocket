-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "public"."messages" ADD COLUMN     "embedding" vector;

-- AlterTable
ALTER TABLE "public"."rooms" ADD COLUMN     "description" TEXT;
