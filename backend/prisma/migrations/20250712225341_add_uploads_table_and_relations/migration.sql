-- AlterTable
ALTER TABLE "FaturaItem" ADD COLUMN     "uploadId" INTEGER;

-- AlterTable
ALTER TABLE "Gasto" ADD COLUMN     "uploadId" INTEGER,
ALTER COLUMN "categoria" DROP NOT NULL,
ALTER COLUMN "origem" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Upload" (
    "id" SERIAL NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "tipoArquivo" TEXT NOT NULL,
    "dataUpload" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaturaItem" ADD CONSTRAINT "FaturaItem_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;
