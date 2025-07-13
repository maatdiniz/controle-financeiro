// frontend/src/pages/AdicionarPlanilha.tsx

import { useState, useEffect, useRef, useContext } from 'react';
import { Title, Text, Group, FileButton, Button, Paper, List, Loader, Center } from '@mantine/core';
import { NotificationContext } from '../context/NotificationContext';

interface Upload { id: number; nomeArquivo: string; dataUpload: string; }

export default function AdicionarPlanilha() {
  const { addNotification } = useContext(NotificationContext);
  const [arquivoCsv, setArquivoCsv] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const resetRef = useRef<() => void>(null);
  const [listaDeUploads, setListaDeUploads] = useState<Upload[]>([]);
  const [carregando, setCarregando] = useState(true);

  const fetchUploads = () => {
    setCarregando(true);
    fetch('http://localhost:3000/uploads?tipo=SPLITWISE_CSV')
      .then(res => res.json())
      .then(data => setListaDeUploads(data))
      .catch(() => addNotification({ title: 'Erro', message: 'Não foi possível carregar o histórico.', color: 'red' }))
      .finally(() => setCarregando(false));
  };

  useEffect(() => { fetchUploads(); }, []);

  const handleImportar = async () => {
    if (!arquivoCsv) return;
    setProcessando(true);
    addNotification({ title: 'Processando...', message: `Importando ${arquivoCsv.name}...`, color: 'blue' });
    const formData = new FormData();
    formData.append('splitwise_csv', arquivoCsv);
    try {
      const response = await fetch('http://localhost:3000/upload/splitwise', { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Erro no servidor');
      addNotification({ title: 'Importação Concluída', message: `Ficheiro processado. Adicionados: ${result.adicionados}, Ignorados: ${result.ignorados}.`, color: 'green' });
      fetchUploads();
    } catch (err: any) {
      addNotification({ title: 'Erro na importação', message: err.message, color: 'red' });
    } finally {
      setProcessando(false);
      setArquivoCsv(null);
      resetRef.current?.();
    }
  };

  return (
    <>
      <Title order={2}>Importar Planilha de Gastos (Estilo Splitwise)</Title>
      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <Title order={4}>Importar Novo Ficheiro</Title>
        <Text size="sm" c="dimmed" mt={4}>O ficheiro deve ser um .csv exportado do Splitwise.</Text>
        <Group mt="md">
            <FileButton resetRef={resetRef} onChange={setArquivoCsv} accept=".csv">{(props) => <Button {...props}>Selecionar Planilha</Button>}</FileButton>
            <Button onClick={handleImportar} disabled={!arquivoCsv} loading={processando}>Importar</Button>
        </Group>
        {arquivoCsv && <Text size="sm" mt="sm">Ficheiro: {arquivoCsv.name}</Text>}
      </Paper>
      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
         <Title order={4}>Histórico de Importações</Title>
         {carregando ? <Center mt="lg"><Loader /></Center> : (
            <List spacing="xs" size="sm" mt="lg">
                {listaDeUploads.length > 0 ? (
                    listaDeUploads.map((upload) => (<List.Item key={upload.id}>{upload.nomeArquivo} - <Text span c="dimmed" size="xs">em {new Date(upload.dataUpload).toLocaleString()}</Text></List.Item>))
                ) : (
                    <Text size="sm" c="dimmed">Nenhuma planilha foi importada ainda.</Text>
                )}
            </List>
         )}
      </Paper>
    </>
  );
}