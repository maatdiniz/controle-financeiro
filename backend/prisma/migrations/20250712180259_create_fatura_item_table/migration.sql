-- CreateTable
CREATE TABLE "FaturaItem" (
    "id" SERIAL NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "lancamento" TEXT NOT NULL,
    "categoria" TEXT,
    "tipo" TEXT,
    "valor" DOUBLE PRECISION NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaturaItem_pkey" PRIMARY KEY ("id")
);
