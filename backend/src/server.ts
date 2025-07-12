// backend/src/server.ts

import express from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { Readable } from 'stream'; // Importe o Readable do stream
import csvParser from 'csv-parser';
import * as XLSX from 'xlsx';
import cors from 'cors';

// Inicializa o Prisma e o Express
const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

// Configura o Multer para salvar o arquivo em memória
const upload = multer({ storage: multer.memoryStorage() });

const port = 3000;

app.get('/', (req, res) => {
  res.send('Servidor está de pé! Envie um POST para /upload com seu arquivo CSV.');
});

app.post('/gastos', async (req, res) => {
  try {
    // Pegamos os dados do corpo (body) da requisição
    const { data, descricao, categoria, custoTotal, suaParte, parteParceiro } = req.body;

    // Uma pequena validação para garantir que os campos essenciais existem
    if (!descricao || !custoTotal) {
      return res.status(400).json({ error: 'Descrição e Custo Total são obrigatórios.' });
    }

    const novoGasto = await prisma.gasto.create({
      data: {
        data: data ? new Date(data) : new Date(), // Se não mandar data, usa a de hoje
        descricao,
        categoria: categoria || 'Geral', // Se não mandar categoria, usa 'Geral'
        custoTotal,
        suaParte,
        parteParceiro,
        moeda: 'BRL', // Moeda fixa por enquanto
        origem: 'manual',
      },
    });

    // Retorna o gasto recém-criado com status 201 (Created)
    res.status(201).json(novoGasto);

  } catch (error) {
    console.error("Erro ao criar gasto:", error);
    res.status(500).send("Erro interno ao salvar o gasto.");
  }
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
          origem: 'csv', // <-- ADICIONE ESTA LINHA
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

// Rota para listar todos os gastos
app.get('/gastos', async (req, res) => {
  try {
    const todosOsGastos = await prisma.gasto.findMany({
      // Opcional: ordenar os gastos do mais recente para o mais antigo
      orderBy: {
        data: 'desc',
      },
    });
    res.status(200).json(todosOsGastos);
  } catch (error) {
    console.error("Erro ao buscar gastos:", error);
    res.status(500).send("Erro interno ao buscar os dados.");
  }
});

// Rota para listar todos os gastos
app.get('/gastos', async (req, res) => {
  try {
    const todosOsGastos = await prisma.gasto.findMany({
      // Opcional: ordenar os gastos do mais recente para o mais antigo
      orderBy: {
        data: 'desc',
      },
    });
    res.status(200).json(todosOsGastos);
  } catch (error) {
    console.error("Erro ao buscar gastos:", error);
    res.status(500).send("Erro interno ao buscar os dados.");
  }
});

app.post('/reconciliar', upload.single('fatura'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('Nenhum arquivo de fatura enviado.');
  }

  console.log(`Recebido arquivo de fatura: ${req.file.originalname}`);

  try {
    // 1. LER O ARQUIVO DE FATURA (XLSX ou CSV)
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const faturaSheet = workbook.Sheets[sheetName];
    // Converte a planilha para um array de objetos JSON
    const itensFatura = XLSX.utils.sheet_to_json(faturaSheet) as any[];

    // 2. BUSCAR GASTOS NÃO CONCILIADOS DO BANCO
    const gastosNaoConciliados = await prisma.gasto.findMany({
      where: { conciliado: false },
    });

    // 3. OTIMIZAR A BUSCA com um "Mapa de Consulta"
    // A chave do mapa será "Data-Valor" para uma busca rápida
    const mapaGastos = new Map<string, any>();
    gastosNaoConciliados.forEach(gasto => {
      // Ajusta a data para o fuso horário local para evitar erros de um dia a mais/a menos
      const dataLocal = new Date(gasto.data.getTime() - (gasto.data.getTimezoneOffset() * 60000));
      const chave = `${dataLocal.toISOString().split('T')[0]}_${gasto.custoTotal.toFixed(2)}`;
      if (!mapaGastos.has(chave)) {
        mapaGastos.set(chave, []);
      }
      mapaGastos.get(chave)?.push(gasto);
    });

    const idsParaAtualizar: number[] = [];

    // 4. COMPARAR E ENCONTRAR VÍNCULOS
    itensFatura.forEach(item => {
      // O XLSX pode ler a data como um número serial, precisamos converter
      const dataFatura = XLSX.SSF.parse_date_code(item.Data);
      const dataLocalFatura = new Date(dataFatura.y, dataFatura.m - 1, dataFatura.d);
      
      const valorFatura = parseFloat(item.Valor);

      if (isNaN(valorFatura)) return;

      const chaveBusca = `${dataLocalFatura.toISOString().split('T')[0]}_${valorFatura.toFixed(2)}`;
      
      // Se encontrarmos um gasto com a mesma data e valor
      const gastosCorrespondentes = mapaGastos.get(chaveBusca);
      if (gastosCorrespondentes && gastosCorrespondentes.length > 0) {
        // Pega o primeiro gasto correspondente e o remove da lista para não vincular duas vezes
        const gastoVinculado = gastosCorrespondentes.shift();
        if (gastoVinculado) {
          console.log(`Vínculo encontrado: Fatura [${chaveBusca}] com Gasto ID [${gastoVinculado.id}]`);
          idsParaAtualizar.push(gastoVinculado.id);
        }
      }
    });

    // 5. ATUALIZAR O BANCO DE DADOS
    if (idsParaAtualizar.length > 0) {
      await prisma.gasto.updateMany({
        where: {
          id: { in: idsParaAtualizar },
        },
        data: {
          conciliado: true,
          faturaInfo: req.file.originalname, // Guarda o nome do arquivo da fatura
        },
      });
    }

    res.status(200).json({
      message: 'Conciliação processada.',
      vinculosEncontrados: idsParaAtualizar.length,
      totalItensFatura: itensFatura.length,
    });

  } catch (error) {
    console.error("Erro ao processar fatura:", error);
    res.status(500).send("Erro interno ao processar a fatura.");
  }
});

app.listen(port, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${port}`);
});