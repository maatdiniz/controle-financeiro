// frontend/src/pages/ListaGastos.tsx

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Table, Group, TextInput, Button, ScrollArea, Center, Loader, Text, Badge, FileButton } from '@mantine/core';
import { notifications } from '@mantine/notifications'; // Importa a API de notificações

// Interface Gasto, agora com os campos de conciliação
interface Gasto {
  id: number;
  data: string;
  descricao: string;
  categoria: string;
  custoTotal: number;
  moeda: string;
  suaParte: number;
  parteParceiro: number;
  origem: 'csv' | 'manual';
  conciliado: boolean;
  faturaInfo: string | null;
}

export default function ListaGastos() {
  const [todosOsGastos, setTodosOsGastos] = useState<Gasto[]>([]);
  const [gastosExibidos, setGastosExibidos] = useState<Gasto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Estados de interatividade
  const [textoBusca, setTextoBusca] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('');
  const [colunaOrdenada, setColunaOrdenada] = useState<keyof Gasto | null>('data');
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState<'asc' | 'desc'>('desc');

  // NOVOS ESTADOS PARA A RECONCILIAÇÃO
  const [arquivoFatura, setArquivoFatura] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const resetRef = useRef<() => void>(null); // Para limpar o botão de arquivo

  // Função para recarregar os dados do backend
  const fetchGastos = () => {
    fetch('http://localhost:3000/gastos')
      .then(res => {
        if (!res.ok) throw new Error('Falha ao buscar dados');
        return res.json();
      })
      .then(data => {
        setTodosOsGastos(data);
      })
      .catch(err => {
        setErro(err.message);
      })
      .finally(() => {
        setCarregando(false);
      });
  };

  // Efeito inicial para carregar os dados
  useEffect(() => {
    fetchGastos();
  }, []);

  // Efeito para filtrar e ordenar a tabela
  useEffect(() => {
    // ... (o código deste useEffect continua o mesmo)
    let dados = [...todosOsGastos];
    if (filtroAtivo) { dados = dados.filter(g => g.descricao.toLowerCase().includes(filtroAtivo.toLowerCase())); }
    if (colunaOrdenada) {
      dados.sort((a, b) => {
        const aValue = a[colunaOrdenada]; const bValue = b[colunaOrdenada];
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
  
  // NOVA FUNÇÃO para lidar com a reconciliação
  const handleReconciliar = async () => {
    if (!arquivoFatura) return;
    setProcessando(true);

    const formData = new FormData();
    formData.append('fatura', arquivoFatura);

    try {
      const response = await fetch('http://localhost:3000/reconciliar', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Erro no servidor');

      notifications.show({
        title: 'Sucesso!',
        message: `Conciliação processada. ${result.vinculosEncontrados} vínculos realizados.`,
        color: 'green',
      });
      
      fetchGastos(); // Recarrega os dados para mostrar as linhas coloridas
      
    } catch (err: any) {
      notifications.show({
        title: 'Erro na conciliação',
        message: err.message,
        color: 'red',
      });
    } finally {
      setProcessando(false);
      setArquivoFatura(null);
      resetRef.current?.(); // Limpa a seleção de arquivo
    }
  };


  const rows = gastosExibidos.map((gasto) => (
    // Aplica um estilo na linha inteira se o gasto estiver conciliado
    <Table.Tr key={gasto.id} style={{ background: gasto.conciliado ? 'var(--mantine-color-green-light)' : undefined }}>
      {/* ... (o conteúdo das células <Table.Td> continua o mesmo) ... */}
      <Table.Td>
        <Center>
            <Badge color={gasto.origem === 'manual' ? 'blue' : 'teal'} variant="light">
              {gasto.origem.toUpperCase()}
            </Badge>
        </Center>
      </Table.Td>
      <Table.Td>{new Date(gasto.data).toLocaleDateString()}</Table.Td>
      <Table.Td>{gasto.descricao}</Table.Td>
      <Table.Td>{gasto.categoria}</Table.Td>
      <Table.Td align="right">{gasto.custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
      <Table.Td align="right">{gasto.suaParte.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
      <Table.Td align="right">{gasto.parteParceiro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
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

        {/* NOVA ÁREA DE RECONCILIAÇÃO */}
        <Group>
          <FileButton resetRef={resetRef} onChange={setArquivoFatura} accept=".xlsx, .csv">
            {(props) => <Button {...props}>Selecionar Fatura</Button>}
          </FileButton>
          <Button onClick={handleReconciliar} disabled={!arquivoFatura} loading={processando}>
            Reconciliar
          </Button>
        </Group>

        <Button component={Link} to="/adicionar">Adicionar Gasto</Button>
      </Group>

      <ScrollArea style={{ flexGrow: 1 }}>
        {/* ... (o código da Table, Thead, e Tbody continua o mesmo) ... */}
        <Table miw={850} striped highlightOnHover withColumnBorders stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 100, textAlign: 'center' }}>Origem</Table.Th>
              <Table.Th style={{ width: 120, cursor: 'pointer' }} onClick={() => handleSort('data')}>Data</Table.Th>
              <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleSort('descricao')}>Descrição</Table.Th>
              <Table.Th style={{ width: 180, cursor: 'pointer' }} onClick={() => handleSort('categoria')}>Categoria</Table.Th>
              <Table.Th style={{ width: 150, textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('custoTotal')}>Custo Total</Table.Th>
              <Table.Th style={{ width: 150, textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('suaParte')}>Parte (Matheus)</Table.Th>
              <Table.Th style={{ width: 150, textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('parteParceiro')}>Parte (Rodrigo)</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{rows.length > 0 ? rows : <Table.Tr><Table.Td colSpan={7}><Center>Nenhum gasto encontrado.</Center></Table.Td></Table.Tr>}</Table.Tbody>
        </Table>
      </ScrollArea>
    </div>
  );
}