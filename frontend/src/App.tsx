// frontend/src/App.tsx

import { useState, useContext } from 'react';
import { AppShell, Title, Group, Burger, Text, Notification, Button, ScrollArea } from '@mantine/core';
import { Outlet } from 'react-router-dom';
// AQUI ESTÁ A CORREÇÃO: Usamos 'import type' para importar apenas a definição do tipo.
import { NotificationContext } from './context/NotificationContext';
import type { AppNotification } from './context/NotificationContext';

// Componente auxiliar para um item da notificação
function NotificationItem({ notification }: { notification: AppNotification }) {
  return (
    <Notification
      color={notification.color}
      title={notification.title}
      withCloseButton={false}
    >
      {notification.message}
    </Notification>
  );
}

// Componente principal da aplicação
export default function App() {
  const [menuAberto, setMenuAberto] = useState(false);
  const { notifications, clearNotifications } = useContext(NotificationContext);

  return (
    <AppShell
      header={{ height: 60 }}
      footer={{ height: 60 }}
      navbar={{ width: 300, breakpoint: 'sm', collapsed: { mobile: !menuAberto } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Burger opened={menuAberto} onClick={() => setMenuAberto((o) => !o)} hiddenFrom="sm" size="sm" />
          <Title order={3}>Controle Financeiro</Title>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Group justify="space-between">
            <Text>Notificações</Text>
            {notifications.length > 0 && (
                <Button variant="subtle" size="xs" onClick={clearNotifications}>
                    Limpar Tudo
                </Button>
            )}
        </Group>
        <ScrollArea style={{ height: 'calc(100% - 40px)', marginTop: '10px' }}>
          {notifications.length === 0 ? (
            <Text size="sm" c="dimmed">Nenhuma notificação</Text>
          ) : (
            notifications.map(notif => (
              <NotificationItem key={notif.id} notification={notif} mt="sm" />
            ))
          )}
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>

      <AppShell.Footer p="md">
        <Group justify="flex-end">
          <Text size="sm" c="dimmed">Pronto.</Text>
        </Group>
      </AppShell.Footer>
    </AppShell>
  );
}