// frontend/src/pages/Recebimentos.tsx

import { useState, useEffect } from 'react';
import { Table, Title, Text, Center, Loader, ScrollArea } from '@mantine/core';

// Interface para definir a estrutura de um Recebimento
interface Recebimento {
  id: number;
  data: string;
  descricao: string;
  valor: number;
  origem: string | null;
}

export default function Recebimentos() {
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Função para buscar os dados do backend
  const fetchRecebimentos = () => {
    setCarregando(true);
    fetch('http://localhost:3000/recebimentos')
      .then(res => {
        if (!res.ok) throw new Error('Falha ao buscar a lista de recebimentos.');
        return res.json();
      })
      .then(data => {
        setRecebimentos(data);
      })
      .catch(err => {
        setErro(err.message);
        // Aqui poderíamos usar o nosso painel de notificações
      })
      .finally(() => {
        setCarregando(false);
      });
  };

  // useEffect para buscar os dados quando a página carrega
  useEffect(() => {
    fetchRecebimentos();
  }, []);

  // Mapeia os dados para as linhas da tabela
  const rows = recebimentos.map((item) => (
    <Table.Tr key={item.id}>
      <Table.Td>{new Date(item.data).toLocaleDateString()}</Table.Td>
      <Table.Td>{item.descricao}</Table.Td>
      <Table.Td>{item.origem}</Table.Td>
      <Table.Td align="right">{item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
    </Table.Tr>
  ));

  if (carregando) return <Center style={{ height: '100%' }}><Loader /></Center>;
  if (erro) return <Center style={{ height: '100%' }}><Text color="red">{erro}</Text></Center>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Title order={2} mb="md">Meus Recebimentos</Title>
      
      {/* Futuramente, adicionaremos botões de ação aqui, como "Adicionar Recebimento" */}

      <ScrollArea style={{ flexGrow: 1 }}>
        <Table miw={700} striped highlightOnHover withColumnBorders stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{width: 150}}>Data</Table.Th>
              <Table.Th>Descrição</Table.Th>
              <Table.Th>Origem</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Valor</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length > 0 ? rows : (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Center>Nenhum recebimento encontrado.</Center>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </div>
  );
}