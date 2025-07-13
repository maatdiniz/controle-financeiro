// frontend/src/pages/ConciliacaoManual.tsx

import { useState, useEffect } from 'react';
import { Title, Grid, Paper, Text, Center, Loader } from '@mantine/core';

// Reutilizamos a interface Gasto
interface Gasto { id: number; data: string; descricao: string; custoTotal: number; }

export default function ConciliacaoManual() {
  const [gastosPendentes, setGastosPendentes] = useState<Gasto[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    // Busca apenas os gastos NÃO conciliados
    fetch('http://localhost:3000/gastos?conciliado=false&pageSize=200') // Pega até 200 gastos pendentes
      .then(res => res.json())
      .then(data => {
        setGastosPendentes(data.data);
      })
      .finally(() => {
        setCarregando(false);
      });
  }, []);

  return (
    <>
      <Title order={2} mb="xl">Conciliação Manual</Title>
      <Grid>
        {/* Coluna da Esquerda: Lista de Gastos Pendentes */}
        <Grid.Col span={6}>
          <Paper withBorder p="md">
            <Title order={4} mb="md">Gastos Pendentes</Title>
            {carregando ? <Center><Loader /></Center> : (
                <List>
                    {gastosPendentes.map(gasto => (
                        <ListItem key={gasto.id}>
                           {new Date(gasto.data).toLocaleDateString()} - {gasto.descricao} - {gasto.custoTotal.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
                           {/* Futuramente, aqui teremos um botão de ação */}
                        </ListItem>
                    ))}
                </List>
            )}
          </Paper>
        </Grid.Col>

        {/* Coluna da Direita: Área de Ações */}
        <Grid.Col span={6}>
          <Paper withBorder p="md" style={{ minHeight: 400 }}>
             <Center style={{height: '100%'}}>
                <Text c="dimmed">Selecione um gasto à esquerda para ver as ações.</Text>
             </Center>
          </Paper>
        </Grid.Col>
      </Grid>
    </>
  );
}

// Pequenos componentes auxiliares para a lista
function List({children}: {children: React.ReactNode}) {
    return <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>{children}</div>;
}

function ListItem({children}: {children: React.ReactNode}) {
    return <Paper withBorder p="xs" radius="sm" style={{cursor: 'pointer'}}>{children}</Paper>;
}