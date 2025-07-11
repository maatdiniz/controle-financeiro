// backend/src/server.ts

import express from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { Readable } from 'stream'; // Importe o Readable do stream
import csvParser from 'csv-parser';

// Inicializa o Prisma e o Express
const prisma = new PrismaClient();
const app = express();

// Configura o Multer para salvar o arquivo em memória
const upload = multer({ storage: multer.memoryStorage() });

const port = 3000;

app.get('/', (req, res) => {
  res.send('Servidor está de pé! Envie um POST para /upload com seu arquivo CSV.');
});

// Rota de Upload
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('Nenhum arquivo enviado.');
  }

  console.log('Arquivo recebido. Lendo cabeçalhos e processando...');

  const gastosParaSalvar: any[] = [];
  // Variáveis para guardar os nomes das colunas de usuários dinamicamente
  let pessoa1Header: string;
  let pessoa2Header: string;

  try {
    const readableStream = Readable.from(req.file.buffer);

    readableStream
      .pipe(
        csvParser()
          .on('headers', (headers: string[]) => {
            // Capturamos os nomes do cabeçalho!
            // O Splitwise coloca os nomes dos envolvidos a partir da 6ª coluna (índice 5)
            if (headers.length > 6) {
              pessoa1Header = headers[5];
              pessoa2Header = headers[6];
              console.log(`Colunas de usuário detectadas: '${pessoa1Header}' e '${pessoa2Header}'`);
            }
          })
      )
      .on('data', (row) => {
        // Validação para garantir que os cabeçalhos foram lidos antes de processar
        if (!pessoa1Header || !pessoa2Header) {
          return;
        }

        // Usamos os nomes de coluna em Português e os nomes dinâmicos!
        const custoTotal = parseFloat(row['Custo']);
        const partePessoa1 = parseFloat(row[pessoa1Header]);
        const partePessoa2 = parseFloat(row[pessoa2Header]);

        // Se qualquer valor numérico for inválido (como na linha "Saldo total"), a linha é ignorada.
        if (isNaN(custoTotal) || isNaN(partePessoa1) || isNaN(partePessoa2)) {
          // console.warn('Linha ignorada por conter valores numéricos inválidos:', row); // Opcional: pode remover para limpar o log
          return;
        }

        // ATENÇÃO: Mapeie a pessoa para a coluna correta do banco.
        // Aqui, estou assumindo que 'suaParte' é a primeira pessoa (Matheus)
        // e 'parteParceiro' é a segunda (Rodrigo).
        gastosParaSalvar.push({
          data: new Date(row['Data']),
          descricao: row['Descrição'],
          categoria: row['Categoria'],
          custoTotal: custoTotal,
          moeda: row['Moeda'],
          suaParte: partePessoa1,
          parteParceiro: partePessoa2,
        });
      })
      .on('end', async () => {
        if (gastosParaSalvar.length === 0) {
          console.log('Nenhum gasto válido encontrado no arquivo.');
          return res.status(400).send('Nenhum dado válido encontrado no CSV.');
        }

        console.log(`Processando ${gastosParaSalvar.length} gastos para salvar...`);

        const result = await prisma.gasto.createMany({
          data: gastosParaSalvar,
          skipDuplicates: true,
        });

        console.log(`${result.count} gastos importados com sucesso!`);
        res.status(201).send({
          message: `${result.count} gastos importados com sucesso!`,
          totalRows: gastosParaSalvar.length
        });
      })
      .on('error', (error) => {
        console.error("Erro ao ler o stream do CSV:", error);
        res.status(500).send('Erro ao processar o arquivo CSV.');
      });

  } catch (error) {
    console.error("Erro inesperado na rota de upload:", error);
    res.status(500).send('Erro interno no servidor.');
  }
});

app.listen(port, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${port}`);
});