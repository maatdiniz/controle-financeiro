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

// --- ROTAS DA API ---

// ROTA GET /gastos (com paginação, filtro, ordenação)
// ROTA GET /gastos ATUALIZADA para aceitar filtro de 'conciliado'
app.get('/gastos', async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 50;
        const filtro = req.query.filtro as string || '';
        const colunaOrdenada = req.query.coluna as string || 'data';
        const direcaoOrdenacao = req.query.direcao as 'asc' | 'desc' || 'desc';
        
        // NOVO PARÂMETRO:
        const conciliadoStatus = req.query.conciliado as string; // 'true', 'false', ou undefined

        const skip = (page - 1) * pageSize;

        const where: Prisma.GastoWhereInput = filtro ? { descricao: { contains: filtro, mode: 'insensitive' } } : {};
        
        // Adiciona a condição de conciliação ao 'where' se ela for fornecida
        if (conciliadoStatus === 'true') {
            where.conciliado = true;
        } else if (conciliadoStatus === 'false') {
            where.conciliado = false;
        }

        const orderBy: Prisma.GastoOrderByWithRelationInput = { [colunaOrdenada]: direcaoOrdenacao };
        
        const [gastos, totalGastos] = await prisma.$transaction([
            prisma.gasto.findMany({ where, orderBy, skip, take: pageSize }),
            prisma.gasto.count({ where })
        ]);

        res.status(200).json({ data: gastos, total: totalGastos, page: page, totalPages: Math.ceil(totalGastos / pageSize) });
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

app.post('/upload/splitwise', upload.single('splitwise_csv'), async (req, res) => {
    if (!req.file) return res.status(400).send('Nenhum arquivo enviado.');
    const novoUpload = await prisma.upload.create({ data: { nomeArquivo: req.file.originalname, tipoArquivo: 'SPLITWISE_CSV' } });
    const gastosDoCsv: any[] = [];
    Readable.from(req.file.buffer).pipe(csvParser()).on('data', (data) => gastosDoCsv.push(data)).on('end', async () => {
        let novosGastosAdicionados = 0, gastosIgnorados = 0;
        const headers = Object.keys(gastosDoCsv[0] || {});
        const nomeMatheus = headers[6], nomeRodrigo = headers[7];
        if (!nomeMatheus || !nomeRodrigo) { return res.status(400).send('Formato de CSV do Splitwise inválido.'); }
        for (const row of gastosDoCsv) {
            try {
                const custoTotal = parseFloat(row['Cost']);
                const dataGasto = new Date(row['Date']);
                const descricao = row['Description'];
                if (isNaN(custoTotal) || !descricao || !dataGasto) { gastosIgnorados++; continue; }
                const gastoExistente = await prisma.gasto.findFirst({ where: { data: dataGasto, descricao, custoTotal } });
                if (gastoExistente) { gastosIgnorados++; continue; }
                const parteMatheusRaw = parseFloat(row[nomeMatheus]), parteRodrigoRaw = parseFloat(row[nomeRodrigo]);
                let custoFinalMatheus = 0, custoFinalRodrigo = 0;
                if (parteMatheusRaw < 0 && Math.abs(parteMatheusRaw) === custoTotal) { custoFinalMatheus = custoTotal; }
                else if (parteRodrigoRaw < 0 && Math.abs(parteRodrigoRaw) === custoTotal) { custoFinalRodrigo = custoTotal; }
                else { custoFinalMatheus = Math.abs(parteMatheusRaw); custoFinalRodrigo = Math.abs(parteRodrigoRaw); }
                await prisma.gasto.create({ data: { data: dataGasto, descricao, categoria: row['Category'], custoTotal, moeda: row['Currency'], suaParte: custoFinalMatheus, parteParceiro: custoFinalRodrigo, origem: 'csv', uploadId: novoUpload.id } });
                novosGastosAdicionados++;
            } catch (error) { gastosIgnorados++; }
        }
        res.status(201).json({ message: 'Importação concluída.', adicionados: novosGastosAdicionados, ignorados: gastosIgnorados });
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


// INICIA O SERVIDOR
app.listen(port, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${port}`);
});