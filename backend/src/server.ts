// backend/src/server.ts

import express from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();
const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = 3000;

app.use(cors());
app.use(express.json());

// --- FUNÇÃO AUXILIAR PARA LOG COM HORA ---
function log(message: string, data?: any) {
  const timestamp = new Date().toLocaleTimeString('pt-BR');
  if (data !== undefined) {
    console.log(`[${timestamp}] ${message}`, data);
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
}

// --- FUNÇÃO AUXILIAR PARA DATAS ---
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
            const dia = parseInt(partes[0], 10);
            const mes = parseInt(partes[1], 10) - 1;
            const ano = parseInt(partes[2], 10);
            if (!isNaN(dia) && !isNaN(mes) && !isNaN(ano)) {
                return new Date(Date.UTC(ano, mes, dia));
            }
        }
    }
    return null;
}

// --- ROTA: BUSCAR GASTOS ---
app.get('/gastos', async (req, res) => {
    try {
        const todosOsGastos = await prisma.gasto.findMany({ orderBy: { data: 'desc' } });
        res.status(200).json(todosOsGastos);
    } catch (error) {
        log("Erro ao buscar dados:", error);
        res.status(500).send("Erro ao buscar dados.");
    }
});

// --- ROTA: ADICIONAR GASTO MANUAL ---
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
        log("Erro ao salvar o gasto:", error);
        res.status(500).send("Erro ao salvar o gasto.");
    }
});

// --- ROTA: CONCILIAR FATURA ---
app.post('/conciliar', upload.single('fatura'), async (req, res) => {
    log('\n--- Rota /conciliar chamada ---');
    if (!req.file) {
        log('ERRO: Nenhum ficheiro recebido pelo multer.');
        return res.status(400).send('Nenhum arquivo de fatura enviado.');
    }
    log(`[PASSO 1] Ficheiro "${req.file.originalname}" recebido.`);

    try {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const faturaSheet = workbook.Sheets[sheetName];
        const itensFaturaJson = XLSX.utils.sheet_to_json(faturaSheet) as any[];
        log('[PASSO 2] Planilha lida e convertida para JSON.');

        const itensParaSalvar = itensFaturaJson.map(item => {
            const valorString = String(item.Valor || '0').replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
            const valor = parseFloat(valorString);
            const dataCorreta = parseDataFlex(item.Data);
            if (!dataCorreta || !item.Lançamento || isNaN(valor)) {
                return null;
            }
            return { data: dataCorreta, lancamento: item.Lançamento, categoria: item.Categoria || '', tipo: item.Tipo || '', valor: valor, nomeArquivo: req.file!.originalname };
        }).filter(item => item !== null);

        log(`[PASSO 3] ${itensParaSalvar.length} de ${itensFaturaJson.length} itens foram validados.`);
        if (itensParaSalvar.length === 0) {
            return res.status(400).send('Nenhum item válido encontrado na fatura.');
        }
        
        log('[PASSO 4] Salvando itens da fatura no banco...');
        await prisma.faturaItem.createMany({ data: itensParaSalvar as any, skipDuplicates: true });
        log('[PASSO 5] Itens da fatura salvos.');

        log('[PASSO 6] Iniciando conciliação...');
        const gastosNaoConciliados = await prisma.gasto.findMany({ where: { conciliado: false } });
        
        const mapaGastos = new Map<string, any[]>();
        log("--- Construindo mapa de chaves dos GASTOS existentes ---");
        gastosNaoConciliados.forEach(gasto => {
            const chave = `${gasto.data.toISOString().split('T')[0]}_${gasto.custoTotal.toFixed(2)}`;
            log(`  - Gasto ID ${gasto.id}: Chave='${chave}'`);
            if (!mapaGastos.has(chave)) mapaGastos.set(chave, []);
            mapaGastos.get(chave)?.push(gasto);
        });

        const idsParaAtualizar: number[] = [];
        log("--- Procurando por vínculos com base nos ITENS DA FATURA ---");
        itensParaSalvar.forEach(itemFatura => {
            if (!itemFatura) return;
            const chaveBusca = `${itemFatura.data.toISOString().split('T')[0]}_${itemFatura.valor.toFixed(2)}`;
            log(`  - Procurando por Chave='${chaveBusca}'...`);
            const gastosCorrespondentes = mapaGastos.get(chaveBusca);
            if (gastosCorrespondentes && gastosCorrespondentes.length > 0) {
                const gastoVinculado = gastosCorrespondentes.shift();
                if (gastoVinculado) {
                    log(`    ✔ VÍNCULO ENCONTRADO! Gasto ID ${gastoVinculado.id}`);
                    idsParaAtualizar.push(gastoVinculado.id);
                }
            }
        });
        log(`[PASSO 7] ${idsParaAtualizar.length} vínculos totais encontrados.`);

        if (idsParaAtualizar.length > 0) {
            log('[PASSO 8] Atualizando gastos no banco...');
            await prisma.gasto.updateMany({
                where: { id: { in: idsParaAtualizar } },
                data: { conciliado: true, faturaInfo: req.file!.originalname },
            });
            log('[PASSO 9] Gastos atualizados.');
        }

        log('[PASSO 10] Enviando resposta de sucesso.');
        res.status(200).json({
            message: `${itensParaSalvar.length} itens da fatura foram salvos.`,
            vinculosEncontrados: idsParaAtualizar.length,
        });

    } catch (error) {
        log("--- ERRO FATAL NO PROCESSAMENTO ---", error);
        res.status(500).send("Erro interno ao processar a fatura.");
    }
});


app.listen(port, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${port}`);
});