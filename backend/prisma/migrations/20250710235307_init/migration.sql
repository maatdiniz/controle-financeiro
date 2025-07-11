-- CreateTable
CREATE TABLE "Gasto" (
    "id" SERIAL NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "custoTotal" DOUBLE PRECISION NOT NULL,
    "moeda" TEXT NOT NULL,
    "suaParte" DOUBLE PRECISION NOT NULL,
    "parteParceiro" DOUBLE PRECISION NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gasto_pkey" PRIMARY KEY ("id")
);
