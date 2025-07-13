// frontend/src/pages/Faturas.tsx

import { useState, useEffect, useRef, useContext } from 'react';
import { Title, Text, Group, FileButton, Button, Paper, List, ThemeIcon, Loader, Center } from '@mantine/core';
import { IconFileText } from '@tabler/icons-react';
import { NotificationContext } from '../context/NotificationContext';

// Interface para o dado de upload que vem do backend
interface Upload {
  id: number;
  nomeArquivo: string;
  dataUpload: string;
}

export default function Faturas() {
  const { addNotification } = useContext(NotificationContext);
  const [arquivoFatura, setArquivoFatura] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const resetRef = useRef<() => void>(null);

  const [listaDeFaturas, setListaDeFaturas] = useState<Upload[]>([]);
  const [carregandoFaturas, setCarregandoFaturas] = useState(true);

  const fetchFaturas = () => {
    setCarregandoFaturas(true);
    // AQUI ESTÁ A CORREÇÃO PRINCIPAL: Chamando a rota correta
    fetch('http://localhost:3000/uploads?tipo=FATURA')
      .then(res => {
        if (!res.ok) throw new Error('Falha ao buscar a lista de faturas.');
        return res.json();
      })
      .then(data => {
        setListaDeFaturas(data);
      })
      .catch(err => {
        addNotification({ title: 'Erro', message: err.message, color: 'red' });
      })
      .finally(() => {
        setCarregandoFaturas(false);
      });
  };

  useEffect(() => {
    fetchFaturas();
  }, []);

  const handleConciliar = async () => {
    if (!arquivoFatura) return;
    setProcessando(true);
    addNotification({ title: 'Processando...', message: `Iniciada a conciliação de ${arquivoFatura.name}.`, color: 'blue' });

    const formData = new FormData();
    formData.append('fatura', arquivoFatura);

    try {
      const response = await fetch('http://localhost:3000/conciliar', { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Erro no servidor');

      addNotification({
        title: 'Sucesso!',
        message: `Conciliação concluída. ${result.vinculosEncontrados} vínculos realizados.`,
        color: 'green',
      });
      
      fetchFaturas();
      
    } catch (err: any) {
      addNotification({ title: 'Erro na conciliação', message: err.message, color: 'red' });
    } finally {
      setProcessando(false);
      setArquivoFatura(null);
      resetRef.current?.();
    }
  };


  return (
    <>
      <Title order={2}>Gestão de Faturas</Title>
      
      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <Title order={4}>Conciliar Nova Fatura</Title>
        <Text size="sm" c="dimmed" mt={4}>
            A fatura deve ser .xlsx ou .csv com as colunas: Data, Lançamento, Categoria, Tipo, Valor
        </Text>
        <Group mt="md">
            <FileButton resetRef={resetRef} onChange={setArquivoFatura} accept=".xlsx, .csv">
              {(props) => <Button {...props}>Selecionar Fatura</Button>}
            </FileButton>
            <Button onClick={handleConciliar} disabled={!arquivoFatura} loading={processando}>
              Conciliar
            </Button>
        </Group>
        {arquivoFatura && (
            <Text size="sm" mt="sm">Ficheiro selecionado: {arquivoFatura.name}</Text>
        )}
      </Paper>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
         <Title order={4}>Faturas Enviadas</Title>
         {carregandoFaturas ? (
            <Center mt="lg"><Loader /></Center>
         ) : (
            <List spacing="xs" size="sm" center mt="lg" icon={ <ThemeIcon color="gray" size={24} radius="xl"><IconFileText size="1rem" /></ThemeIcon> }>
                {listaDeFaturas.length > 0 ? (
                    listaDeFaturas.map((upload) => (
                        <List.Item key={upload.id}>{upload.nomeArquivo}</List.Item>
                    ))
                ) : (
                    <Text size="sm" c="dimmed">Nenhuma fatura foi enviada ainda.</Text>
                )}
            </List>
         )}
      </Paper>
    </>
  );
}