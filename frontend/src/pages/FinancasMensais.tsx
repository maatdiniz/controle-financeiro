// frontend/src/pages/FinancasMensais.tsx

import { useState, useEffect } from 'react';
import { Title, Paper, Group, Select, Loader, Center, Text, SimpleGrid, RingProgress, Card } from '@mantine/core';

interface ResumoFinanceiro {
  totalRecebimentos: number;
  totalGastos: number;
  balancoFinal: number;
  detalheGastos: {
    totalSuaParte: number;
    totalParteParceiro: number;
  };
}

function StatCard({ title, value, color }: { title: string; value: number; color?: string }) {
    return (
        <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed">{title}</Text>
            <Text fz="xl" fw={700} c={color}>
                {value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </Text>
        </Paper>
    );
}

export default function FinancasMensais() {
  const [data, setData] = useState<ResumoFinanceiro | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [mes, setMes] = useState<string | null>((new Date().getMonth() + 1).toString());
  const [ano, setAno] = useState<string | null>(new Date().getFullYear().toString());

  useEffect(() => {
    if (mes && ano) {
      setCarregando(true);
      setErro(null);
      fetch(`http://localhost:3000/financas?ano=${ano}&mes=${mes}`)
        .then(res => {
            if(!res.ok) throw new Error("Falha ao buscar dados do resumo.");
            return res.json();
        })
        .then(resumo => {
            setData(resumo);
        })
        .catch(err => {
            setErro(err.message);
            setData(null);
        })
        .finally(() => {
            setCarregando(false);
        });
    }
  }, [mes, ano]);

  const anosDisponiveis = ['2025', '2024', '2023'];
  const mesesDisponiveis = [
    { value: '1', label: 'Janeiro' }, { value: '2', label: 'Fevereiro' }, { value: '3', label: 'Março' },
    { value: '4', label: 'Abril' }, { value: '5', label: 'Maio' }, { value: '6', label: 'Junho' },
    { value: '7', label: 'Julho' }, { value: '8', label: 'Agosto' }, { value: '9', label: 'Setembro' },
    { value: '10', label: 'Outubro' }, { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
  ];

  return (
    <>
      <Group justify="space-between" align="center">
        <Title order={2}>Finanças Mensais</Title>
        <Group>
            <Select label="Mês" data={mesesDisponiveis} value={mes} onChange={setMes} />
            <Select label="Ano" data={anosDisponiveis} value={ano} onChange={setAno} />
        </Group>
      </Group>

      {carregando && <Center mt="xl"><Loader /></Center>}
      {erro && <Center mt="xl"><Text color="red">{erro}</Text></Center>}
      
      {data && !carregando && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mt="xl">
            <StatCard title="Total de Recebimentos" value={data.totalRecebimentos} color="green" />
            <StatCard title="Total de Gastos" value={data.totalGastos} color="red" />
            <StatCard title="Balanço Final" value={data.balancoFinal} color={data.balancoFinal >= 0 ? 'blue' : 'orange'} />
             <Card withBorder p="md" radius="md">
                <Group justify='space-between'>
                    <Text size="xs" c="dimmed">Divisão de Gastos</Text>
                </Group>
                <Group justify='space-around' mt="md">
                    <RingProgress
                        size={80}
                        thickness={8}
                        roundCaps
                        label={<Text size="xs" ta="center">Total</Text>}
                        sections={[
                            { value: (data.totalGastos > 0 ? (data.detalheGastos.totalSuaParte / data.totalGastos) * 100 : 0), color: 'cyan' },
                            { value: (data.totalGastos > 0 ? (data.detalheGastos.totalParteParceiro / data.totalGastos) * 100 : 0), color: 'pink' },
                        ]}
                    />
                    <div>
                        <Text c="cyan" fw={700}>Sua Parte: {data.detalheGastos.totalSuaParte.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>
                        <Text c="pink" fw={700}>Parte Parceiro: {data.detalheGastos.totalParteParceiro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>
                    </div>
                </Group>
            </Card>
        </SimpleGrid>
      )}
    </>
  );
}