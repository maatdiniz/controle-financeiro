// backend/src/server.ts

import express from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { Readable } from 'stream';
import csvParser from 'csv-parser';
import cors from 'cors';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();
const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Servidor está de pé.');
});

// Rota de Upload de CSV
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('Nenhum arquivo enviado.');
  }
  const gastosParaSalvar: any[] = [];
  let pessoa1Header: string, pessoa2Header: string;

  try {
    const readableStream = Readable.from(req.file.buffer);
    readableStream
      .pipe(csvParser().on('headers', (headers: string[]) => {
        if (headers.length > 6) {
          pessoa1Header = headers[5];
          pessoa2Header = headers[6];
        }
      }))
      .on('data', (row) => {
        if (!pessoa1Header || !pessoa2Header) return;
        const custoTotal = parseFloat(row['Custo']);
        const partePessoa1 = parseFloat(row[pessoa1Header]);
        const partePessoa2 = parseFloat(row[pessoa2Header]);
        if (isNaN(custoTotal) || isNaN(partePessoa1) || isNaN(partePessoa2)) return;
        gastosParaSalvar.push({
          data: new Date(row['Data']),
          descricao: row['Descrição'],
          categoria: row['Categoria'],
          custoTotal: custoTotal,
          moeda: row['Moeda'],
          suaParte: partePessoa1,
          parteParceiro: partePessoa2,
          origem: 'csv',
        });
      })
      .on('end', async () => {
        if (gastosParaSalvar.length === 0) {
          return res.status(400).send('Nenhum dado válido encontrado no CSV.');
        }
        const result = await prisma.gasto.createMany({
          data: gastosParaSalvar,
          skipDuplicates: true,
        });
        res.status(201).send({ message: `${result.count} gastos importados com sucesso!`, totalRows: gastosParaSalvar.length });
      });
  } catch (error) {
    res.status(500).send('Erro interno no servidor.');
  }
});

// Rota para buscar gastos
app.get('/gastos', async (req, res) => {
  try {
    const todosOsGastos = await prisma.gasto.findMany({ orderBy: { data: 'desc' } });
    res.status(200).json(todosOsGastos);
  } catch (error) {
    res.status(500).send("Erro interno ao buscar os dados.");
  }
});

// Rota para criar um novo gasto
app.post('/gastos', async (req, res) => {
  try {
    const { data, descricao, categoria, custoTotal, suaParte, parteParceiro } = req.body;
    if (!descricao || !custoTotal) {
      return res.status(400).json({ error: 'Descrição e Custo Total são obrigatórios.' });
    }
    const novoGasto = await prisma.gasto.create({
      data: {
        data: data ? new Date(data) : new Date(),
        descricao,
        categoria: categoria || 'Geral',
        custoTotal,
        suaParte,
        parteParceiro,
        moeda: 'BRL',
        origem: 'manual',
      },
    });
    res.status(201).json(novoGasto);
  } catch (error) {
    res.status(500).send("Erro interno ao salvar o gasto.");
  }
});

// Rota para CONCILIAÇÃO de faturas (XLSX ou CSV)
app.post('/conciliar', upload.single('fatura'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('Nenhum arquivo de fatura enviado.');
  }

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const faturaSheet = workbook.Sheets[sheetName];
    const itensFaturaJson = XLSX.utils.sheet_to_json(faturaSheet) as any[];

    // 1. TRANSFORMAR E VALIDAR OS DADOS DA PLANILHA
    const itensParaSalvar = itensFaturaJson.map(item => {
      const valor = parseFloat(item.Valor);
      if (!item.Data || !item.Lançamento || isNaN(valor)) {
        return null; // Ignora linhas inválidas
      }
      const dataFatura = XLSX.SSF.parse_date_code(item.Data);
      return {
        data: new Date(dataFatura.y, dataFatura.m - 1, dataFatura.d),
        lancamento: item.Lançamento,
        categoria: item.Categoria || '',
        tipo: item.Tipo || '',
        valor: valor,
        nomeArquivo: req.file!.originalname,
      };
    }).filter(item => item !== null); // Remove as linhas nulas

    if (itensParaSalvar.length === 0) {
      return res.status(400).send('Nenhum item válido encontrado na fatura.');
    }

    // 2. SALVAR TODOS OS ITENS DA FATURA NO BANCO DE DADOS
    await prisma.faturaItem.createMany({
      data: itensParaSalvar,
    });

    // 3. FAZER A CONCILIAÇÃO (LÓGICA DE COMPARAÇÃO)
    const gastosNaoConciliados = await prisma.gasto.findMany({
      where: { conciliado: false },
    });

    const mapaGastos = new Map<string, any[]>();
    gastosNaoConciliados.forEach(gasto => {
      const dataLocal = new Date(gasto.data.getTime() - (gasto.data.getTimezoneOffset() * 60000));
      const chave = `${dataLocal.toISOString().split('T')[0]}_${gasto.custoTotal.toFixed(2)}`;
      if (!mapaGastos.has(chave)) {
        mapaGastos.set(chave, []);
      }
      mapaGastos.get(chave)?.push(gasto);
    });

    const idsParaAtualizar: number[] = [];
    itensParaSalvar.forEach(itemFatura => {
      const chaveBusca = `${itemFatura!.data.toISOString().split('T')[0]}_${itemFatura!.valor.toFixed(2)}`;
      const gastosCorrespondentes = mapaGastos.get(chaveBusca);
      if (gastosCorrespondentes && gastosCorrespondentes.length > 0) {
        const gastoVinculado = gastosCorrespondentes.shift();
        if (gastoVinculado) {
          idsParaAtualizar.push(gastoVinculado.id);
        }
      }
    });

    // 4. ATUALIZAR OS GASTOS VINCULADOS
    if (idsParaAtualizar.length > 0) {
      await prisma.gasto.updateMany({
        where: { id: { in: idsParaAtualizar } },
        data: {
          conciliado: true,
          faturaInfo: req.file!.originalname,
        },
      });
    }

    res.status(200).json({
      message: `${itensParaSalvar.length} itens da fatura foram salvos.`,
      vinculosEncontrados: idsParaAtualizar.length,
    });

  } catch (error) {
    console.error("Erro ao processar fatura:", error);
    res.status(500).send("Erro interno ao processar a fatura.");
  }
});

app.listen(port, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${port}`);
});