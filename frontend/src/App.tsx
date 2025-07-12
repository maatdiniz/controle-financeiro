// frontend/src/App.tsx

import { useState } from 'react';
import { AppShell, Title, Group, Burger, Text } from '@mantine/core';
import { Outlet } from 'react-router-dom'; // O Outlet renderiza as páginas filhas

export default function App() {
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <AppShell
      header={{ height: 60 }}
      footer={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !menuAberto } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Burger opened={menuAberto} onClick={() => setMenuAberto((o) => !o)} hiddenFrom="sm" size="sm" />
          <Title order={3}>Controle Financeiro</Title>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">Menu</AppShell.Navbar>

      <AppShell.Main>
        {/* O Outlet é o espaço reservado onde as páginas (Lista ou Adicionar) serão renderizadas */}
        <Outlet />
      </AppShell.Main>

      <AppShell.Footer p="md">
        <Group justify="flex-end">
          <Text size="sm" c="dimmed">
            Status da Aplicação
          </Text>
        </Group>
      </AppShell.Footer>
    </AppShell>
  );
}