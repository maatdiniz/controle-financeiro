// frontend/src/App.tsx

import { useState, useContext } from 'react';
import { AppShell, Title, Group, Burger, Text, Notification, Button, ScrollArea, NavLink } from '@mantine/core';
import { Outlet, Link } from 'react-router-dom';
import { IconHome, IconFileInvoice, IconPlus, IconUpload } from '@tabler/icons-react';
import { NotificationContext } from './context/NotificationContext';
import type { AppNotification } from './context/NotificationContext';

// O componente agora recebe a função de dispensar
function NotificationItem({ notification, onDismiss }: { notification: AppNotification; onDismiss: () => void; [key: string]: any }) {
  return (
    <Notification
      color={notification.color}
      title={notification.title}
      withCloseButton // <-- Habilita o botão 'X'
      onClose={onDismiss} // <-- Diz ao 'X' o que fazer ao ser clicado
    >
      {notification.message}
    </Notification>
  );
}

export default function App() {
  const [menuAberto, setMenuAberto] = useState(false);
  const { notifications, dismissNotification, clearNotifications } = useContext(NotificationContext);

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
        <NavLink label="Visão Geral" component={Link} to="/" leftSection={<IconHome size="1rem" />} />
        <NavLink label="Faturas" component={Link} to="/faturas" leftSection={<IconFileInvoice size="1rem" />} />
        <NavLink label="Importar Planilha" component={Link} to="/importar-planilha" leftSection={<IconUpload size="1rem" />} />
        <NavLink label="Adicionar Gasto" component={Link} to="/adicionar" leftSection={<IconPlus size="1rem" />} />

        <Text size="xs" c="dimmed" mt="xl" mb="xs">PAINEL DE NOTIFICAÇÕES</Text>
        <ScrollArea style={{ height: 'calc(100% - 210px)'}}>
          {notifications.length === 0 ? (
            <Text size="sm" c="dimmed">Nenhuma notificação</Text>
          ) : (
            // Agora passamos a função dismiss para cada item
            notifications.map(notif => (
              <NotificationItem 
                key={notif.id} 
                notification={notif} 
                onDismiss={() => dismissNotification(notif.id)} 
                mt="sm" 
              />
            ))
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <Button variant="light" size="xs" onClick={clearNotifications} fullWidth mt="sm">
            Limpar Tudo
          </Button>
        )}
      </AppShell.Navbar>

      <AppShell.Main><Outlet /></AppShell.Main>

      <AppShell.Footer p="md">
        <Group justify="flex-end"><Text size="sm" c="dimmed">Pronto.</Text></Group>
      </AppShell.Footer>
    </AppShell>
  );
}