// frontend/src/pages/EditarGasto.tsx

import { useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm } from '@mantine/form';
import { TextInput, Paper, Title, Group, Button, NumberInput, Center, Loader, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import 'dayjs/locale/pt-br';

export default function EditarGasto() {
  const navigate = useNavigate();
  const { id } = useParams(); // Pega o ID da URL
  const gastoId = parseInt(id || '0');

  const form = useForm({
    initialValues: {
      data: new Date(),
      descricao: '',
      categoria: '',
      custoTotal: 0,
      suaParte: 0,
      parteParceiro: 0,
    },
    validate: {
      descricao: (value) => (value.length < 2 ? 'Descrição muito curta' : null),
      custoTotal: (value) => (value <= 0 ? 'O custo deve ser maior que zero' : null),
    },
  });
  
  // useEffect para buscar os dados do gasto quando a página carrega
  useEffect(() => {
    if (gastoId) {
      fetch(`http://localhost:3000/gastos/${gastoId}`)
        .then(res => {
            if (res.status === 403) throw new Error('Não é permitido editar este gasto.');
            if (!res.ok) throw new Error('Falha ao buscar dados do gasto.');
            return res.json();
        })
        .then(data => {
            // Preenche o formulário com os dados recebidos
            form.setValues({
                ...data,
                data: new Date(data.data), // Converte a string de data para um objeto Date
            });
        })
        .catch(err => {
            // Em caso de erro, pode-se adicionar uma notificação
            console.error(err);
            navigate('/'); // Volta para a lista
        });
    }
  }, [gastoId]);

  const handleSubmit = async (values: typeof form.values) => {
    try {
      const response = await fetch(`http://localhost:3000/gastos/${gastoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error('Falha ao atualizar o gasto.');
      navigate('/'); // Volta para a lista após sucesso
    } catch (error) {
      console.error("Erro ao atualizar o formulário:", error);
    }
  };
  
  if (!form.values.descricao && gastoId) {
      return <Center style={{height: '100%'}}><Loader/></Center>
  }

  return (
    <Paper withBorder shadow="md" p={30} mt={30} radius="md">
      <Title order={2} ta="center" mb="xl">
        Editar Gasto (ID: {gastoId})
      </Title>
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <DatePickerInput locale="pt-br" label="Data do Gasto" required {...form.getInputProps('data')} />
        <TextInput mt="md" label="Descrição" required {...form.getInputProps('descricao')} />
        <TextInput mt="md" label="Categoria" {...form.getInputProps('categoria')} />
        <NumberInput mt="md" label="Custo Total" required {...form.getInputProps('custoTotal')} />
        <Group grow mt="md">
          <NumberInput label="Sua Parte (Matheus)" {...form.getInputProps('suaParte')} />
          <NumberInput label="Parte do Parceiro (Rodrigo)" {...form.getInputProps('parteParceiro')} />
        </Group>
        <Group justify="space-between" mt="xl">
          <Button component={Link} to="/" variant="default">Cancelar</Button>
          <Button type="submit">Salvar Alterações</Button>
        </Group>
      </form>
    </Paper>
  );
}