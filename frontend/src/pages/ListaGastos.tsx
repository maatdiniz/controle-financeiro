// frontend/src/pages/ListaGastos.tsx

import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Table, Group, TextInput, Button, ScrollArea, Center, Loader, Text, Badge, ActionIcon, Tooltip } from '@mantine/core';
import { IconTrash, IconPencil } from '@tabler/icons-react'; // Adiciona o ícone de lápis
import { NotificationContext } from '../context/NotificationContext';

interface Gasto { id: number; data: string; descricao: string; categoria: string | null; custoTotal: number; moeda: string; suaParte: number; parteParceiro: number; origem: 'csv' | 'manual'; conciliado: boolean; faturaInfo: string | null; }

export default function ListaGastos() {
  const { addNotification } = useContext(NotificationContext);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [textoBusca, setTextoBusca] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('');
  const [colunaOrdenada, setColunaOrdenada] = useState<keyof Gasto | null>('data');
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState<'asc' | 'desc'>('desc');
  const [activePage, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchGastos = () => {
    setCarregando(true);
    const params = new URLSearchParams({ page: activePage.toString(), pageSize: '50', filtro: filtroAtivo, coluna: colunaOrdenada || 'data', direcao: direcaoOrdenacao, });
    fetch(`http://localhost:3000/gastos?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        setGastos(data.data);
        setTotalPages(data.totalPages);
        setTotalRecords(data.total);
      })
      .catch(err => { setErro(err.message); })
      .finally(() => { setCarregando(false); });
  };

  useEffect(() => {
    fetchGastos();
  }, [activePage, filtroAtivo, colunaOrdenada, direcaoOrdenacao]);

  const handleSort = (coluna: keyof Gasto) => {
    const novaDirecao = coluna === colunaOrdenada && direcaoOrdenacao === 'asc' ? 'desc' : 'asc';
    setColunaOrdenada(coluna);
    setDirecaoOrdenacao(novaDirecao);
    setPage(1);
  };
  const handleBuscarClick = () => {
    setFiltroAtivo(textoBusca);
    setPage(1);
  };
  const handleExcluir = async (gastoId: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este gasto?')) return;
    try {
      const response = await fetch(`http://localhost:3000/gastos/${gastoId}`, { method: 'DELETE' });
      if (!response.ok) { const res = await response.json(); throw new Error(res.error || 'Falha ao excluir.'); }
      addNotification({ title: 'Sucesso', message: `Gasto ID ${gastoId} foi excluído.`, color: 'green' });
      fetchGastos();
    } catch (err: any) {
      addNotification({ title: 'Erro ao Excluir', message: err.message, color: 'red' });
    }
  };

  const rows = gastos.map((gasto) => (
    <Table.Tr key={gasto.id} style={{ background: gasto.conciliado ? 'var(--mantine-color-green-light)' : undefined }}>
        <Table.Td><Center><Badge color={gasto.origem === 'manual' ? 'blue' : 'teal'} variant="light">{gasto.origem.toUpperCase()}</Badge></Center></Table.Td>
        <Table.Td>{new Date(gasto.data).toLocaleDateString()}</Table.Td>
        <Table.Td>{gasto.descricao}</Table.Td>
        <Table.Td>{gasto.categoria}</Table.Td>
        <Table.Td align="right">{gasto.custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
        <Table.Td>
            <Group gap="xs" justify="center">
                {gasto.origem === 'manual' && (
                    <>
                        <Tooltip label="Editar Gasto">
                            <ActionIcon component={Link} to={`/editar/${gasto.id}`} color="blue" variant="subtle">
                                <IconPencil size={18} />
                            </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Excluir Gasto">
                            <ActionIcon color="red" variant="subtle" onClick={() => handleExcluir(gasto.id)}>
                                <IconTrash size={18} />
                            </ActionIcon>
                        </Tooltip>
                    </>
                )}
            </Group>
        </Table.Td>
    </Table.Tr>
  ));

  if (carregando && gastos.length === 0) return <Center style={{ height: '100%' }}><Loader /></Center>;
  if (erro) return <Center style={{ height: '100%' }}><Text color="red">{erro}</Text></Center>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Group justify="space-between" mb="md">
        <Group><TextInput placeholder="Filtrar por descrição..." value={textoBusca} onChange={(e) => setTextoBusca(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleBuscarClick() }}/><Button onClick={handleBuscarClick} loading={carregando}>Buscar</Button></Group>
        <Button component={Link} to="/adicionar">Adicionar Gasto</Button>
      </Group>

      <ScrollArea style={{ flexGrow: 1 }}>
        <Table miw={800} striped highlightOnHover withColumnBorders stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 100, textAlign: 'center' }}>Origem</Table.Th>
              <Table.Th style={{ width: 120, cursor: 'pointer' }} onClick={() => handleSort('data')}>Data</Table.Th>
              <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleSort('descricao')}>Descrição</Table.Th>
              <Table.Th style={{ width: 180, cursor: 'pointer' }} onClick={() => handleSort('categoria')}>Categoria</Table.Th>
              <Table.Th style={{ width: 180, textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('custoTotal')}>Custo Total</Table.Th>
              <Table.Th style={{ width: 80, textAlign: 'center' }}>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{rows.length > 0 ? rows : <Table.Tr><Table.Td colSpan={6}><Center>Nenhum gasto encontrado.</Center></Table.Td></Table.Tr>}</Table.Tbody>
        </Table>
      </ScrollArea>
      
      <Group justify="space-between" mt="md">
        <Text size="sm">Total de registros: {totalRecords}</Text>
        <Pagination total={totalPages} value={activePage} onChange={setPage} />
      </Group>
    </div>
  );
}