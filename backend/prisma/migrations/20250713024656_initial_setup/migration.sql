/*
  Warnings:

  - A unique constraint covering the columns `[faturaItemId]` on the table `Gasto` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Gasto" ADD COLUMN     "faturaItemId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Gasto_faturaItemId_key" ON "Gasto"("faturaItemId");

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_faturaItemId_fkey" FOREIGN KEY ("faturaItemId") REFERENCES "FaturaItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
