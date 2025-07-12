// frontend/src/pages/AdicionarGasto.tsx

import { useNavigate, Link } from 'react-router-dom';
import { useForm } from '@mantine/form';
import { TextInput, Paper, Title, Group, Button, NumberInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import 'dayjs/locale/pt-br';

export default function AdicionarGasto() {
  const navigate = useNavigate();

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
      data: (value) => (value === null ? 'A data é obrigatória' : null),
      descricao: (value) => (value.length < 2 ? 'Descrição muito curta' : null),
      custoTotal: (value) => (value <= 0 ? 'O custo deve ser maior que zero' : null),
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    try {
      const response = await fetch('http://localhost:3000/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error('Falha ao salvar o gasto.');
      navigate('/');
    } catch (error) {
      console.error("Erro ao enviar o formulário:", error);
    }
  };

  return (
    <Paper withBorder shadow="md" p={30} mt={30} radius="md">
      <Title order={2} ta="center" mb="xl">
        Adicionar Novo Gasto Manual
      </Title>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <DatePickerInput
          locale="pt-br"
          label="Data do Gasto"
          placeholder="Selecione a data"
          valueFormat="DD/MM/YYYY"
          required
          {...form.getInputProps('data')}
        />
        <TextInput
          mt="md"
          label="Descrição"
          placeholder="Ex: Almoço no restaurante"
          required
          {...form.getInputProps('descricao')}
        />
        <TextInput
          mt="md"
          label="Categoria"
          placeholder="Ex: Alimentação"
          {...form.getInputProps('categoria')}
        />
        <NumberInput
          mt="md"
          label="Custo Total"
          placeholder="0,00"
          required
          decimalScale={2}
          fixedDecimalScale
          decimalSeparator=","
          thousandSeparator="."
          {...form.getInputProps('custoTotal')}
        />
        <Group grow mt="md">
          <NumberInput
            label="Sua Parte (Matheus)"
            decimalScale={2}
            fixedDecimalScale
            decimalSeparator=","
            thousandSeparator="."
            {...form.getInputProps('suaParte')}
          />
          <NumberInput
            label="Parte do Parceiro (Rodrigo)"
            decimalScale={2}
            fixedDecimalScale
            decimalSeparator=","
            thousandSeparator="."
            {...form.getInputProps('parteParceiro')}
          />
        </Group>

        <Group justify="space-between" mt="xl">
          <Button component={Link} to="/" variant="default">
            Cancelar
          </Button>
          <Button type="submit">Salvar Gasto</Button>
        </Group>
      </form>
    </Paper>
  );
}