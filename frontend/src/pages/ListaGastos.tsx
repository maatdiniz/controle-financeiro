// frontend/src/pages/ListaGastos.tsx

import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Table, Group, TextInput, Button, ScrollArea, Center, Loader, Text, Badge, ActionIcon, Tooltip } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react'; // Importa o ícone de lixeira
import { NotificationContext } from '../context/NotificationContext';

// Interface Gasto (sem alterações)
interface Gasto { id: number; data: string; descricao: string; categoria: string; custoTotal: number; moeda: string; suaParte: number; parteParceiro: number; origem: 'csv' | 'manual'; conciliado: boolean; faturaInfo: string | null; }

export default function ListaGastos() {
  const { addNotification } = useContext(NotificationContext);

  const [todosOsGastos, setTodosOsGastos] = useState<Gasto[]>([]);
  const [gastosExibidos, setGastosExibidos] = useState<Gasto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [textoBusca, setTextoBusca] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('');
  const [colunaOrdenada, setColunaOrdenada] = useState<keyof Gasto | null>('data');
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState<'asc' | 'desc'>('desc');
  
  // O código para conciliação foi removido para esta etapa, 
  // podemos adicioná-lo de volta depois.
  
  const fetchGastos = () => {
    setCarregando(true);
    fetch('http://localhost:3000/gastos')
      .then(res => { if (!res.ok) throw new Error('Falha ao buscar dados'); return res.json(); })
      .then(data => { setTodosOsGastos(data); })
      .catch(err => { setErro(err.message); })
      .finally(() => { setCarregando(false); });
  };

  useEffect(() => { fetchGastos(); }, []);

  useEffect(() => {
    let dados = [...todosOsGastos];
    if (filtroAtivo) { dados = dados.filter(g => g.descricao.toLowerCase().includes(filtroAtivo.toLowerCase())); }
    if (colunaOrdenada) {
      dados.sort((a, b) => {
        const aValue = a[colunaOrdenada!]; const bValue = b[colunaOrdenada!];
        if (aValue === null) return 1; if (bValue === null) return -1;
        if (aValue < bValue) return direcaoOrdenacao === 'asc' ? -1 : 1;
        if (aValue > bValue) return direcaoOrdenacao === 'asc' ? 1 : -1;
        return 0;
      });
    }
    setGastosExibidos(dados);
  }, [filtroAtivo, colunaOrdenada, direcaoOrdenacao, todosOsGastos]);

  const handleSort = (coluna: keyof Gasto) => {
    const novaDirecao = coluna === colunaOrdenada && direcaoOrdenacao === 'asc' ? 'desc' : 'asc';
    setColunaOrdenada(coluna);
    setDirecaoOrdenacao(novaDirecao);
  };
  const handleBuscarClick = () => setFiltroAtivo(textoBusca);
  
  // NOVA FUNÇÃO PARA EXCLUIR UM GASTO
  const handleExcluir = async (gastoId: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este gasto?')) {
      return;
    }
    try {
      const response = await fetch(`http://localhost:3000/gastos/${gastoId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const res = await response.json();
        throw new Error(res.error || 'Falha ao excluir o gasto.');
      }
      // Remove o gasto da lista na tela para feedback imediato
      setTodosOsGastos(gastosAtuais => gastosAtuais.filter(g => g.id !== gastoId));
      addNotification({ title: 'Sucesso', message: `Gasto ID ${gastoId} foi excluído.`, color: 'green' });
    } catch (err: any) {
      addNotification({ title: 'Erro ao Excluir', message: err.message, color: 'red' });
    }
  };

  const rows = gastosExibidos.map((gasto) => (
    <Table.Tr key={gasto.id} style={{ background: gasto.conciliado ? 'var(--mantine-color-green-light)' : undefined }}>
        <Table.Td><Center><Badge color={gasto.origem === 'manual' ? 'blue' : 'teal'} variant="light">{gasto.origem.toUpperCase()}</Badge></Center></Table.Td>
        <Table.Td>{new Date(gasto.data).toLocaleDateString()}</Table.Td>
        <Table.Td>{gasto.descricao}</Table.Td>
        <Table.Td>{gasto.categoria}</Table.Td>
        <Table.Td align="right">{gasto.custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
        <Table.Td align="right">{gasto.suaParte.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
        <Table.Td align="right">{gasto.parteParceiro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
        {/* NOVA CÉLULA DE AÇÕES */}
        <Table.Td>
            <Center>
                {gasto.origem === 'manual' && (
                    <Tooltip label="Excluir Gasto">
                        <ActionIcon color="red" variant="subtle" onClick={() => handleExcluir(gasto.id)}>
                            <IconTrash size={18} />
                        </ActionIcon>
                    </Tooltip>
                )}
            </Center>
        </Table.Td>
    </Table.Tr>
  ));

  if (carregando) return <Center style={{ height: '100%' }}><Loader /></Center>;
  if (erro) return <Center style={{ height: '100%' }}><Text color="red">{erro}</Text></Center>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Group justify="space-between" mb="md">
        <Group>
          <TextInput placeholder="Filtrar por descrição..." value={textoBusca} onChange={(e) => setTextoBusca(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleBuscarClick() }}/>
          <Button onClick={handleBuscarClick}>Buscar</Button>
        </Group>
        <Button component={Link} to="/adicionar">Adicionar Gasto</Button>
      </Group>

      <ScrollArea style={{ flexGrow: 1 }}>
        <Table miw={900} striped highlightOnHover withColumnBorders stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 100, textAlign: 'center' }}>Origem</Table.Th>
              <Table.Th style={{ width: 120, cursor: 'pointer' }} onClick={() => handleSort('data')}>Data</Table.Th>
              <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleSort('descricao')}>Descrição</Table.Th>
              <Table.Th style={{ width: 180, cursor: 'pointer' }} onClick={() => handleSort('categoria')}>Categoria</Table.Th>
              <Table.Th style={{ width: 150, textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('custoTotal')}>Custo Total</Table.Th>
              <Table.Th style={{ width: 150, textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('suaParte')}>Parte (Matheus)</Table.Th>
              <Table.Th style={{ width: 150, textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('parteParceiro')}>Parte (Rodrigo)</Table.Th>
              <Table.Th style={{ width: 80, textAlign: 'center' }}>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{rows.length > 0 ? rows : <Table.Tr><Table.Td colSpan={8}><Center>Nenhum gasto encontrado.</Center></Table.Td></Table.Tr>}</Table.Tbody>
        </Table>
      </ScrollArea>
    </div>
  );
}