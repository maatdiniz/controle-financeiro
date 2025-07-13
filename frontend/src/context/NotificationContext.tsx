// frontend/src/context/NotificationContext.tsx

import { createContext, useState } from 'react';
import type { ReactNode } from 'react';

export interface AppNotification {
  id: number;
  message: string;
  title: string;
  color: 'green' | 'red' | 'blue';
}

interface NotificationContextType {
  notifications: AppNotification[];
  addNotification: (notification: Omit<AppNotification, 'id'>) => void;
  dismissNotification: (id: number) => void; // 1. Nova função
  clearNotifications: () => void;
}

export const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  addNotification: () => {},
  dismissNotification: () => {}, // 2. Adiciona ao valor padrão
  clearNotifications: () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const addNotification = (notification: Omit<AppNotification, 'id'>) => {
    const newNotification: AppNotification = { id: Date.now(), ...notification };
    setNotifications((current) => [newNotification, ...current]);
  };

  // 3. Implementação da nova função para remover uma notificação pelo seu ID
  const dismissNotification = (id: number) => {
    setNotifications((current) => current.filter(n => n.id !== id));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, dismissNotification, clearNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}