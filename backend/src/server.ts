// backend/src/server.ts

import express from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import * as XLSX from 'xlsx';
import csvParser from 'csv-parser';
import { Readable } from 'stream';

const prisma = new PrismaClient();
const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = 3000;

app.use(cors());
app.use(express.json());

// --- FUNÇÕES AUXILIARES ---
function log(message: string) {
  console.log(`[${new Date().toLocaleTimeString('pt-BR')}] ${message}`);
}

function parseDataFlex(dataInput: any): Date | null {
    if (typeof dataInput === 'number') {
        const dataExcel = XLSX.SSF.parse_date_code(dataInput);
        if (dataExcel?.y && dataExcel?.m && dataExcel?.d) {
            return new Date(Date.UTC(dataExcel.y, dataExcel.m - 1, dataExcel.d));
        }
    }
    if (typeof dataInput === 'string') {
        const partes = dataInput.split('/');
        if (partes.length === 3) {
            const dia = parseInt(partes[0], 10), mes = parseInt(partes[1], 10) - 1, ano = parseInt(partes[2], 10);
            if (!isNaN(dia) && !isNaN(mes) && !isNaN(ano)) {
                return new Date(Date.UTC(ano, mes, dia));
            }
        }
    }
    return null;
}

// --- ROTAS DA API ---

// ROTA PARA BUSCAR GASTOS (com paginação)
app.get('/gastos', async (req, res) => {
    try {
        const todosOsGastos = await prisma.gasto.findMany({ orderBy: { data: 'desc' } });
        res.status(200).json(todosOsGastos);
    } catch (error) {
        log("Erro ao buscar dados: " + error);
        res.status(500).send("Erro ao buscar dados.");
    }
});

// ROTA PARA BUSCAR UPLOADS (por tipo)
app.get('/uploads', async (req, res) => {
    const { tipo } = req.query;
    if (!tipo) {
        return res.status(400).json({ error: 'O tipo de arquivo é obrigatório.' });
    }
    try {
        const uploads = await prisma.upload.findMany({
            where: { tipoArquivo: tipo as string },
            orderBy: { dataUpload: 'desc' }
        });
        res.status(200).json(uploads);
    } catch (error) {
        log("Erro ao buscar uploads: " + error);
        res.status(500).send("Erro ao buscar uploads.");
    }
});


// ROTA PARA ADICIONAR GASTO MANUAL
app.post('/gastos', async (req, res) => {
    try {
        const { data, descricao, categoria, custoTotal, suaParte, parteParceiro } = req.body;
        const novoGasto = await prisma.gasto.create({
            data: {
                data: data ? new Date(data) : new Date(),
                descricao,
                categoria,
                custoTotal,
                suaParte,
                parteParceiro,
                moeda: 'BRL',
                origem: 'manual',
            },
        });
        res.status(201).json(novoGasto);
    } catch (error) {
        log("Erro ao salvar o gasto: " + error);
        res.status(500).send("Erro ao salvar o gasto.");
    }
});


// ROTA PARA UPLOAD DE FATURAS E CONCILIAÇÃO
app.post('/conciliar', upload.single('fatura'), async (req, res) => {
    if (!req.file) return res.status(400).send('Nenhum arquivo enviado.');
    log(`--- Iniciando conciliação para o ficheiro: ${req.file.originalname} ---`);

    // 1. Cria um registo do upload
    const novoUpload = await prisma.upload.create({
        data: {
            nomeArquivo: req.file.originalname,
            tipoArquivo: 'FATURA'
        }
    });

    try {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const itensFaturaJson = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];

        const itensParaSalvar = itensFaturaJson.map(item => {
            const valor = parseFloat(String(item.Valor || '0').replace('R$', '').trim().replace(/\./g, '').replace(',', '.'));
            const dataCorreta = parseDataFlex(item.Data);
            if (!dataCorreta || !item.Lançamento || isNaN(valor)) return null;
            return {
                data: dataCorreta,
                lancamento: item.Lançamento,
                categoria: item.Categoria || '',
                tipo: item.Tipo || '',
                valor,
                nomeArquivo: req.file!.originalname,
                uploadId: novoUpload.id // Liga o item ao upload
            };
        }).filter(Boolean);

        if (itensParaSalvar.length === 0) return res.status(400).send('Nenhum item válido encontrado na fatura.');

        await prisma.faturaItem.createMany({ data: itensParaSalvar as any });

        // A lógica de conciliação continua aqui...
        // ...

        res.status(200).json({ message: `${itensParaSalvar.length} itens da fatura salvos e processados.` });

    } catch (error) {
        log(`Erro ao processar fatura do upload ID ${novoUpload.id}: ` + error);
        res.status(500).send("Erro interno ao processar a fatura.");
    }
});

// ROTA PARA UPLOAD DE CSV DO SPLITWISE (A SER COMPLETADA COM SUA LÓGICA)
app.post('/upload/splitwise', upload.single('splitwise_csv'), async (req, res) => {
    if (!req.file) return res.status(400).send('Nenhum arquivo enviado.');
    log(`--- Iniciando importação Splitwise: ${req.file.originalname} ---`);
    
    // 1. Cria um registo do upload
    const novoUpload = await prisma.upload.create({
        data: {
            nomeArquivo: req.file.originalname,
            tipoArquivo: 'SPLITWISE_CSV'
        }
    });

    // LÓGICA DE LEITURA E PROCESSAMENTO DO CSV AQUI...
    // Esta parte será ajustada conforme as suas regras de negócio que você vai me passar.
    // Por enquanto, ela está como um placeholder.

    res.status(201).json({ message: `Arquivo ${req.file.originalname} recebido. Lógica de importação a ser implementada.` });
});

// --- NOVA ROTA PARA UPLOAD INTELIGENTE DO SPLITWISE ---
app.post('/upload/splitwise', upload.single('splitwise_csv'), async (req, res) => {
    if (!req.file) return res.status(400).send('Nenhum arquivo enviado.');
    log(`--- Iniciando importação Splitwise: ${req.file.originalname} ---`);

    const novoUpload = await prisma.upload.create({
        data: { nomeArquivo: req.file.originalname, tipoArquivo: 'SPLITWISE_CSV' }
    });

    const gastosDoCsv: any[] = [];
    const readableStream = Readable.from(req.file.buffer);

    readableStream
        .pipe(csvParser())
        .on('data', (data) => gastosDoCsv.push(data))
        .on('end', async () => {
            let novosGastosAdicionados = 0;
            let gastosIgnorados = 0;
            const headers = Object.keys(gastosDoCsv[0] || {});
            const nomeMatheus = headers[6]; // Coluna G no excel
            const nomeRodrigo = headers[7]; // Coluna H no excel

            if (!nomeMatheus || !nomeRodrigo) {
                return res.status(400).send('Formato de CSV do Splitwise inválido. Não foi possível encontrar as colunas de divisão de custos.');
            }

            for (const row of gastosDoCsv) {
                try {
                    const custoTotal = parseFloat(row['Cost']);
                    const dataGasto = new Date(row['Date']);
                    const descricao = row['Description'];

                    if (isNaN(custoTotal) || !descricao || !dataGasto) {
                        gastosIgnorados++;
                        continue;
                    }
                    
                    // LÓGICA ANTI-DUPLICADOS: Verifica se um gasto idêntico já existe
                    const gastoExistente = await prisma.gasto.findFirst({
                        where: {
                            data: dataGasto,
                            descricao: descricao,
                            custoTotal: custoTotal,
                        }
                    });

                    if (gastoExistente) {
                        gastosIgnorados++;
                        continue; // Pula para a próxima linha se o gasto já existe
                    }
                    
                    // --- TRADUÇÃO DA SUA LÓGICA DE EXCEL PARA CÓDIGO ---
                    const parteMatheusRaw = parseFloat(row[nomeMatheus]);
                    const parteRodrigoRaw = parseFloat(row[nomeRodrigo]);
                    
                    let custoFinalMatheus = 0;
                    let custoFinalRodrigo = 0;

                    // Cenário: Matheus pagou tudo
                    if (parteMatheusRaw < 0 && Math.abs(parteMatheusRaw) === custoTotal) {
                        custoFinalMatheus = custoTotal;
                        custoFinalRodrigo = 0;
                    } 
                    // Cenário: Rodrigo pagou tudo
                    else if (parteRodrigoRaw < 0 && Math.abs(parteRodrigoRaw) === custoTotal) {
                        custoFinalRodrigo = custoTotal;
                        custoFinalMatheus = 0;
                    }
                    // Cenário: Divisão/Reembolso
                    else {
                        custoFinalMatheus = Math.abs(parteMatheusRaw);
                        custoFinalRodrigo = Math.abs(parteRodrigoRaw);
                    }
                    // --- FIM DA LÓGICA ---

                    await prisma.gasto.create({
                        data: {
                            data: dataGasto,
                            descricao: descricao,
                            categoria: row['Category'],
                            custoTotal: custoTotal,
                            moeda: row['Currency'],
                            suaParte: custoFinalMatheus,
                            parteParceiro: custoFinalRodrigo,
                            origem: 'csv',
                            uploadId: novoUpload.id // Liga o gasto ao upload
                        }
                    });
                    novosGastosAdicionados++;

                } catch (error) {
                    log(`Erro ao processar linha do Splitwise: ${error}`);
                    gastosIgnorados++;
                }
            }

            log(`Importação do Splitwise concluída. Adicionados: ${novosGastosAdicionados}. Ignorados (duplicados ou inválidos): ${gastosIgnorados}.`);
            res.status(201).json({ 
                message: `Importação concluída.`,
                adicionados: novosGastosAdicionados,
                ignorados: gastosIgnorados
            });
        });
});

// ROTA PARA EXCLUIR GASTO MANUAL
app.delete('/gastos/:id', async (req, res) => {
    // ... (código existente da rota delete)
});


// INICIA O SERVIDOR
app.listen(port, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${port}`);
});