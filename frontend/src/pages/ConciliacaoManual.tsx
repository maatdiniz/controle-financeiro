// frontend/src/pages/ConciliacaoManual.tsx

import { useState, useEffect, useContext } from 'react';
import { Title, Grid, Paper, Text, Center, Loader, Select, Group, Button, ScrollArea, SimpleGrid } from '@mantine/core';
import { NotificationContext } from '../context/NotificationContext';

// Interfaces para os nossos dados
interface GastoPendente {
  id: number;
  data: string;
  descricao: string;
  custoTotal: number;
}
interface FaturaItemCandidato {
  id: number;
  data: string;
  lancamento: string;
  valor: number;
  nomeArquivo: string;
}

// Componente para um item da lista de GASTOS à esquerda
function GastoItem({ gasto, onClick, isSelected }: { gasto: GastoPendente, onClick: () => void, isSelected: boolean }) {
    return (
        <Paper withBorder p="xs" radius="sm" onClick={onClick} style={{ cursor: 'pointer', background: isSelected ? 'var(--mantine-color-blue-light)' : undefined }}>
            <Group justify="space-between">
                <div>
                    <Text size="sm" fw={500}>{gasto.descricao}</Text>
                    <Text size="xs" c="dimmed">{new Date(gasto.data).toLocaleDateString()}</Text>
                </div>
                <Text size="sm" fw={500}>{gasto.custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>
            </Group>
        </Paper>
    );
}

// Componente para um item da lista de ITENS DE FATURA à direita
function FaturaItem({ item, onVincular }: { item: FaturaItemCandidato, onVincular: () => void }) {
    return (
        <Paper withBorder p="xs" radius="sm">
             <Group justify="space-between">
                <div>
                    <Text size="sm">{item.lancamento}</Text>
                    <Text size="xs" c="dimmed">{new Date(item.data).toLocaleDateString()} - {item.nomeArquivo}</Text>
                </div>
                <Button variant="light" size="xs" onClick={onVincular}>Vincular</Button>
            </Group>
        </Paper>
    );
}

export default function ConciliacaoManual() {
  const { addNotification } = useContext(NotificationContext);

  const [gastosPendentes, setGastosPendentes] = useState<GastoPendente[]>([]);
  const [carregandoGastos, setCarregandoGastos] = useState(true);
  
  const [gastoSelecionado, setGastoSelecionado] = useState<GastoPendente | null>(null);
  
  // Estados para a coluna da direita
  const [itensCandidatos, setItensCandidatos] = useState<FaturaItemCandidato[]>([]);
  const [carregandoCandidatos, setCarregandoCandidatos] = useState(false);
  
  const [mes, setMes] = useState<string | null>((new Date().getMonth() + 1).toString());
  const [ano, setAno] = useState<string | null>(new Date().getFullYear().toString());

  // Efeito para buscar os gastos pendentes
  useEffect(() => {
    if (mes && ano) {
      setCarregandoGastos(true);
      setGastoSelecionado(null); // Limpa a seleção ao mudar o mês/ano
      setItensCandidatos([]); // Limpa os candidatos
      const params = new URLSearchParams({ conciliado: 'false', mes, ano, pageSize: '500' });
      fetch(`http://localhost:3000/gastos?${params.toString()}`)
        .then(res => res.json())
        .then(data => { setGastosPendentes(data.data); })
        .finally(() => { setCarregandoGastos(false); });
    }
  }, [mes, ano]);

  // Efeito para buscar os itens de fatura candidatos quando um gasto é selecionado
  useEffect(() => {
    if (gastoSelecionado) {
      setCarregandoCandidatos(true);
      const params = new URLSearchParams({
        valor: gastoSelecionado.custoTotal.toString(),
        data: gastoSelecionado.data,
      });
      fetch(`http://localhost:3000/fatura-items/candidatos?${params.toString()}`)
        .then(res => res.json())
        .then(data => { setItensCandidatos(data); })
        .finally(() => { setCarregandoCandidatos(false); });
    }
  }, [gastoSelecionado]);

  // Função para efetivar o vínculo
  const handleVincular = async (faturaItemId: number, nomeArquivo: string) => {
    if (!gastoSelecionado) return;
    try {
        const response = await fetch(`http://localhost:3000/gastos/${gastoSelecionado.id}/vincular`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ faturaItemId, nomeArquivo }),
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Falha ao vincular gasto.');
        }
        addNotification({title: 'Sucesso', message: `Gasto "${gastoSelecionado.descricao}" vinculado com sucesso!`, color: 'green'});
        
        // Atualiza a UI para refletir a mudança
        setGastosPendentes(lista => lista.filter(g => g.id !== gastoSelecionado.id));
        setGastoSelecionado(null);
        setItensCandidatos([]);

    } catch (err: any) {
        addNotification({title: 'Erro', message: err.message, color: 'red'});
    }
  };

  const anosDisponiveis = ['2025', '2024', '2023'];
  const mesesDisponiveis = [ { value: '1', label: 'Janeiro' }, { value: '2', label: 'Fevereiro' }, { value: '3', label: 'Março' }, { value: '4', label: 'Abril' }, { value: '5', label: 'Maio' }, { value: '6', label: 'Junho' }, { value: '7', label: 'Julho' }, { value: '8', label: 'Agosto' }, { value: '9', label: 'Setembro' }, { value: '10', label: 'Outubro' }, { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' } ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Title order={2} mb="md">Conciliação Manual</Title>
      <Grid h="100%">
        {/* Coluna da Esquerda */}
        <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper withBorder p="md" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Title order={4} mb="md">Gastos Pendentes</Title>
                <Group mb="md">
                    <Select data={mesesDisponiveis} value={mes} onChange={setMes} />
                    <Select data={anosDisponiveis} value={ano} onChange={setAno} />
                </Group>
                <ScrollArea style={{ flexGrow: 1 }}>
                    {carregandoGastos ? <Center><Loader /></Center> : (
                        <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                            {gastosPendentes.length > 0 ? gastosPendentes.map(gasto => (
                                <GastoItem key={gasto.id} gasto={gasto} isSelected={gastoSelecionado?.id === gasto.id} onClick={() => setGastoSelecionado(gasto)} />
                            )) : <Text size="sm" c="dimmed">Nenhum gasto pendente para este mês.</Text>}
                        </div>
                    )}
                </ScrollArea>
            </Paper>
        </Grid.Col>

        {/* Coluna da Direita */}
        <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper withBorder p="md" style={{ height: '100%' }}>
                {!gastoSelecionado ? (
                    <Center style={{height: '100%'}}><Text c="dimmed">Selecione um gasto à esquerda.</Text></Center>
                ) : (
                    <div>
                        <Title order={4}>Conciliar Gasto: <Text span c="blue" inherit>{gastoSelecionado.descricao}</Text></Title>
                        <Text size="sm" c="dimmed" mt={4}>Procurando por itens de fatura com valor próximo a {gastoSelecionado.custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.</Text>
                        
                        <ScrollArea style={{height: 'calc(100% - 80px)', marginTop: '20px'}}>
                            {carregandoCandidatos ? <Center><Loader/></Center> : (
                                <SimpleGrid cols={1} spacing="xs">
                                    {itensCandidatos.length > 0 ? itensCandidatos.map(item => (
                                        <FaturaItem key={item.id} item={item} onVincular={() => handleVincular(item.id, item.nomeArquivo)} />
                                    )) : <Text size="sm" c="dimmed">Nenhum item de fatura compatível encontrado.</Text>}
                                </SimpleGrid>
                            )}
                        </ScrollArea>
                    </div>
                )}
            </Paper>
        </Grid.Col>
      </Grid>
    </div>
  );
}