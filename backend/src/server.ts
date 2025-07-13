// backend/src/server.ts

import express from 'express';
import multer from 'multer';
import { Prisma, PrismaClient } from '@prisma/client';
import cors from 'cors';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';
import csvParser from 'csv-parser';

const prisma = new PrismaClient();
const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = 3000;

app.use(cors());
app.use(express.json());

// --- FUNÇÕES AUXILIARES ---
function log(message: string) { console.log(`[${new Date().toLocaleTimeString('pt-BR')}] ${message}`); }
function parseDataFlex(dataInput: any): Date | null {
    if (typeof dataInput === 'number') {
        const dataExcel = XLSX.SSF.parse_date_code(dataInput);
        if (dataExcel?.y && dataExcel?.m && dataExcel?.d) { return new Date(Date.UTC(dataExcel.y, dataExcel.m - 1, dataExcel.d)); }
    }
    if (typeof dataInput === 'string') {
        const partes = dataInput.split('/');
        if (partes.length === 3) {
            const dia = parseInt(partes[0], 10), mes = parseInt(partes[1], 10) - 1, ano = parseInt(partes[2], 10);
            if (!isNaN(dia) && !isNaN(mes) && !isNaN(ano)) { return new Date(Date.UTC(ano, mes, dia)); }
        }
    }
    return null;
}

// --- ROTA GET /gastos ATUALIZADA para aceitar filtro de data ---
// ROTA GET /gastos
app.get('/gastos', async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 50;
        const filtro = req.query.filtro as string || '';
        const colunaOrdenada = req.query.coluna as string || 'data';
        const direcaoOrdenacao = req.query.direcao as 'asc' | 'desc' || 'desc';
        const conciliadoStatus = req.query.conciliado as string;
        const ano = req.query.ano ? parseInt(req.query.ano as string) : null;
        const mes = req.query.mes ? parseInt(req.query.mes as string) : null;
        const skip = (page - 1) * pageSize;
        const where: Prisma.GastoWhereInput = {};
        if (filtro) { where.descricao = { contains: filtro, mode: 'insensitive' }; }
        if (conciliadoStatus === 'true') { where.conciliado = true; }
        if (conciliadoStatus === 'false') { where.conciliado = false; }
        if (ano && mes) {
            const dataInicio = new Date(Date.UTC(ano, mes - 1, 1));
            const dataFim = new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999));
            where.data = { gte: dataInicio, lte: dataFim };
        }
        const orderBy: Prisma.GastoOrderByWithRelationInput = { [colunaOrdenada]: direcaoOrdenacao };
        const [gastos, totalGastos] = await prisma.$transaction([
            prisma.gasto.findMany({ where, orderBy, skip, take: pageSize }),
            prisma.gasto.count({ where })
        ]);
        res.status(200).json({ data: gastos, total: totalGastos, page, totalPages: Math.ceil(totalGastos / pageSize) });
    } catch (error) {
        console.error("Erro ao buscar gastos:", error);
        res.status(500).send("Erro ao buscar gastos.");
    }
});

// ROTA GET /gastos/:id
app.get('/gastos/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const gasto = await prisma.gasto.findUnique({ where: { id } });
        if (!gasto) { return res.status(404).json({ error: 'Gasto não encontrado.' }); }
        res.status(200).json(gasto);
    } catch (error) {
        res.status(500).send("Erro interno ao buscar o gasto.");
    }
});

// ROTA GET /uploads
app.get('/uploads', async (req, res) => {
    const { tipo } = req.query;
    if (!tipo) { return res.status(400).json({ error: 'O tipo de arquivo é obrigatório.' }); }
    try {
        const uploads = await prisma.upload.findMany({ where: { tipoArquivo: tipo as string }, orderBy: { dataUpload: 'desc' } });
        res.status(200).json(uploads);
    } catch (error) {
        res.status(500).send("Erro ao buscar uploads.");
    }
});

// ROTA GET /financas
app.get('/financas', async (req, res) => {
    const ano = parseInt(req.query.ano as string);
    const mes = parseInt(req.query.mes as string);
    if (!ano || !mes) { return res.status(400).json({ error: 'Ano e mês são obrigatórios.' }); }
    try {
        const dataInicio = new Date(Date.UTC(ano, mes - 1, 1));
        const dataFim = new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999));
        const gastosDoMes = await prisma.gasto.findMany({ where: { data: { gte: dataInicio, lte: dataFim } } });
        const recebimentosDoMes = await prisma.recebimento.findMany({ where: { data: { gte: dataInicio, lte: dataFim } } });
        const totalGastos = gastosDoMes.reduce((acc, g) => acc + g.custoTotal, 0);
        const totalSuaParte = gastosDoMes.reduce((acc, g) => acc + g.suaParte, 0);
        const totalParteParceiro = gastosDoMes.reduce((acc, g) => acc + g.parteParceiro, 0);
        const totalRecebimentos = recebimentosDoMes.reduce((acc, r) => acc + r.valor, 0);
        res.status(200).json({ ano, mes, totalRecebimentos, totalGastos, balancoFinal: totalRecebimentos - totalGastos, detalheGastos: { totalSuaParte, totalParteParceiro } });
    } catch (error) {
        res.status(500).send("Erro ao calcular finanças.");
    }
});

// ROTA GET /recebimentos
app.get('/recebimentos', async (req, res) => {
    try {
        const recebimentos = await prisma.recebimento.findMany({ orderBy: { data: 'desc' } });
        res.status(200).json(recebimentos);
    } catch (error) {
        res.status(500).send("Erro ao buscar recebimentos.");
    }
});

// --- ROTAS POST ---
app.post('/gastos', async (req, res) => {
    const { data, descricao, categoria, custoTotal, suaParte, parteParceiro } = req.body;
    try {
        const novoGasto = await prisma.gasto.create({ data: { data: data ? new Date(data) : new Date(), descricao, categoria, custoTotal, suaParte, parteParceiro, moeda: 'BRL', origem: 'manual' } });
        res.status(201).json(novoGasto);
    } catch (error) {
        res.status(500).send("Erro ao salvar gasto.");
    }
});

app.post('/recebimentos', async (req, res) => {
    const { data, descricao, valor, origem } = req.body;
    try {
        const novoRecebimento = await prisma.recebimento.create({ data: { data: data ? new Date(data) : new Date(), descricao, valor, origem: origem || 'OUTROS' } });
        res.status(201).json(novoRecebimento);
    } catch (error) {
        res.status(500).send("Erro ao criar recebimento.");
    }
});

// --- ROTA UPLOAD SPLITWISE (LÓGICA FINAL) ---
app.post('/upload/splitwise', upload.single('splitwise_csv'), async (req, res) => {
    if (!req.file) return res.status(400).send('Nenhum arquivo enviado.');
    log(`--- Iniciando importação Splitwise: ${req.file.originalname} ---`);

    const novoUpload = await prisma.upload.create({
        data: { nomeArquivo: req.file.originalname, tipoArquivo: 'SPLITWISE_CSV' }
    });

    const gastosDoCsv: any[] = [];
    const fileContent = req.file.buffer.toString('utf-8');
    const readableStream = Readable.from(fileContent);

    readableStream
        .pipe(csvParser({
            // AQUI ESTÁ A MÁGICA:
            skipLines: 1, // 1. Pula a primeira linha (os cabeçalhos)
            headers: ['Data', 'Descricao', 'Categoria', 'Custo', 'Moeda', 'Parceiro', 'Eu'] // 2. Define os nomes que vamos usar
        }))
        .on('data', (data) => gastosDoCsv.push(data))
        .on('end', async () => {
            log(`Fim da leitura do CSV. ${gastosDoCsv.length} linhas de dados encontradas.`);
            
            const ultimaLinha = gastosDoCsv[gastosDoCsv.length - 1];
            if (ultimaLinha && ultimaLinha['Descricao'] === 'Saldo total') {
                gastosDoCsv.pop();
                log('Linha de "Saldo total" removida.');
            }

            let novosGastosAdicionados = 0;
            let gastosIgnorados = 0;
            
            for (const row of gastosDoCsv) {
                try {
                    const custoTotal = parseFloat(row['Custo']);
                    const dataGasto = new Date(row['Data']);
                    const descricao = row['Descricao'];

                    if (isNaN(custoTotal) || !descricao || isNaN(dataGasto.getTime())) {
                        gastosIgnorados++;
                        continue;
                    }
                    
                    const gastoExistente = await prisma.gasto.findFirst({
                        where: { data: dataGasto, descricao, custoTotal }
                    });

                    if (gastoExistente) {
                        gastosIgnorados++;
                        continue;
                    }
                    
                    const parteEuRaw = parseFloat(row['Eu']);
                    const parteParceiroRaw = parseFloat(row['Parceiro']);
                    let custoFinalEu = 0;
                    let custoFinalParceiro = 0;

                    if (parteEuRaw < 0 && Math.abs(parteEuRaw).toFixed(2) === custoTotal.toFixed(2)) {
                        custoFinalEu = custoTotal;
                    } 
                    else if (parteParceiroRaw < 0 && Math.abs(parteParceiroRaw).toFixed(2) === custoTotal.toFixed(2)) {
                        custoFinalParceiro = custoTotal;
                    }
                    else {
                        custoFinalEu = Math.abs(parteEuRaw);
                        custoFinalParceiro = Math.abs(parteParceiroRaw);
                    }

                    await prisma.gasto.create({
                        data: {
                            data: dataGasto, descricao, categoria: row['Categoria'], custoTotal, moeda: row['Moeda'],
                            suaParte: custoFinalEu, parteParceiro: custoFinalParceiro, origem: 'csv', uploadId: novoUpload.id
                        }
                    });
                    novosGastosAdicionados++;

                } catch (error) {
                    log(`Erro ao processar linha do Splitwise: ${error}`);
                    gastosIgnorados++;
                }
            }

            log(`Importação concluída. Adicionados: ${novosGastosAdicionados}. Ignorados: ${gastosIgnorados}.`);
            res.status(201).json({ 
                message: `Importação concluída.`,
                adicionados: novosGastosAdicionados,
                ignorados: gastosIgnorados
            });
        });
});   

app.post('/conciliar', upload.single('fatura'), async (req, res) => {
    if (!req.file) return res.status(400).send('Nenhum arquivo enviado.');
    const novoUpload = await prisma.upload.create({ data: { nomeArquivo: req.file.originalname, tipoArquivo: 'FATURA' } });
    try {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const itensFaturaJson = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];
        const itensParaSalvar = itensFaturaJson.map(item => {
            const valor = parseFloat(String(item.Valor || '0').replace('R$', '').trim().replace(/\./g, '').replace(',', '.'));
            const dataCorreta = parseDataFlex(item.Data);
            if (!dataCorreta || !item.Lançamento || isNaN(valor)) return null;
            return { data: dataCorreta, lancamento: item.Lançamento, categoria: item.Categoria || '', tipo: item.Tipo || '', valor, nomeArquivo: req.file!.originalname, uploadId: novoUpload.id };
        }).filter(Boolean);
        if (itensParaSalvar.length === 0) return res.status(400).send('Nenhum item válido na fatura.');
        await prisma.faturaItem.createMany({ data: itensParaSalvar as any });
        let vinculosEncontrados = 0;
        const todosItensFaturaSalvos = await prisma.faturaItem.findMany({ where: { uploadId: novoUpload.id } });
        for (const itemFatura of todosItensFaturaSalvos) {
            const gastoCorrespondente = await prisma.gasto.findFirst({ where: { data: itemFatura.data, custoTotal: itemFatura.valor, conciliado: false } });
            if (gastoCorrespondente) {
                await prisma.gasto.update({ where: { id: gastoCorrespondente.id }, data: { conciliado: true, faturaInfo: req.file.originalname, faturaItemId: itemFatura.id, } });
                vinculosEncontrados++;
            }
        }
        res.status(200).json({ message: `${itensParaSalvar.length} itens da fatura salvos.`, vinculosEncontrados });
    } catch (error) { res.status(500).send("Erro interno ao processar a fatura."); }
});

// --- ROTAS PUT ---
app.put('/gastos/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const { data, descricao, categoria, custoTotal, suaParte, parteParceiro } = req.body;
    try {
        const gastoExistente = await prisma.gasto.findUnique({ where: { id } });
        if (!gastoExistente) { return res.status(404).json({ error: 'Gasto não encontrado.' }); }
        if (gastoExistente.origem !== 'manual') { return res.status(403).json({ error: 'Não é permitido editar um gasto importado.' }); }
        const gastoAtualizado = await prisma.gasto.update({ where: { id }, data: { data: data ? new Date(data) : undefined, descricao, categoria, custoTotal, suaParte, parteParceiro } });
        res.status(200).json(gastoAtualizado);
    } catch (error) { res.status(500).send("Erro ao atualizar gasto."); }
});

app.put('/recebimentos/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const { data, descricao, valor, origem } = req.body;
    try {
        const recebimentoAtualizado = await prisma.recebimento.update({ where: { id }, data: { data: data ? new Date(data) : undefined, descricao, valor, origem } });
        res.status(200).json(recebimentoAtualizado);
    } catch (error) { res.status(500).send("Erro ao atualizar recebimento."); }
});


// --- ROTAS DELETE ---
app.delete('/gastos/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const gastoParaExcluir = await prisma.gasto.findUnique({ where: { id } });
        if (!gastoParaExcluir) { return res.status(404).json({ error: 'Gasto não encontrado.' }); }
        if (gastoParaExcluir.origem !== 'manual') { return res.status(403).json({ error: 'Não é permitido excluir gastos importados.' }); }
        await prisma.gasto.delete({ where: { id } });
        res.status(204).send();
    } catch (error) { res.status(500).send("Erro ao excluir gasto."); }
});

app.delete('/recebimentos/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        await prisma.recebimento.delete({ where: { id } });
        res.status(204).send();
    } catch (error) { res.status(500).send("Erro ao excluir recebimento."); }
});

// --- NOVAS ROTAS PARA CONCILIAÇÃO MANUAL ---

// 1. ROTA PARA BUSCAR ITENS DE FATURA CANDIDATOS
app.get('/fatura-items/candidatos', async (req, res) => {
    const valor = parseFloat(req.query.valor as string);
    const dataGastoStr = req.query.data as string;

    if (!valor || !dataGastoStr) {
        return res.status(400).json({ error: 'Valor e data do gasto são obrigatórios.' });
    }

    try {
        const dataGasto = new Date(dataGastoStr);
        // Procura por itens de fatura com o mesmo valor e numa janela de 5 dias (antes ou depois)
        const dataInicio = new Date(dataGasto);
        dataInicio.setDate(dataGasto.getDate() - 5);
        const dataFim = new Date(dataGasto);
        dataFim.setDate(dataGasto.getDate() + 5);

        const candidatos = await prisma.faturaItem.findMany({
            where: {
                valor: valor,
                data: {
                    gte: dataInicio,
                    lte: dataFim,
                },
                Gasto: null, // Procura apenas por itens de fatura que AINDA NÃO foram vinculados a um gasto
            },
            orderBy: {
                data: 'asc'
            }
        });
        res.status(200).json(candidatos);
    } catch (error) {
        console.error("Erro ao buscar itens de fatura candidatos:", error);
        res.status(500).send("Erro ao buscar itens de fatura.");
    }
});

// 2. ROTA PARA EFETIVAR O VÍNCULO ENTRE UM GASTO E UM ITEM DE FATURA
app.put('/gastos/:gastoId/vincular', async (req, res) => {
    const gastoId = parseInt(req.params.gastoId);
    const { faturaItemId, nomeArquivo } = req.body;

    if (!faturaItemId) {
        return res.status(400).json({ error: 'O ID do item da fatura é obrigatório.' });
    }

    try {
        const gastoAtualizado = await prisma.gasto.update({
            where: { id: gastoId },
            data: {
                conciliado: true,
                faturaItemId: faturaItemId,
                faturaInfo: nomeArquivo,
            }
        });
        res.status(200).json(gastoAtualizado);
    } catch (error) {
        console.error(`Erro ao vincular gasto ${gastoId} com item ${faturaItemId}:`, error);
        // Verifica se o erro é de constraint única (item de fatura já usado)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return res.status(409).json({ error: 'Este item da fatura já está vinculado a outro gasto.' });
        }
        res.status(500).send("Erro ao criar o vínculo.");
    }
});

// INICIA O SERVIDOR
app.listen(port, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${port}`);
});