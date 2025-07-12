// frontend/src/context/NotificationContext.tsx

import { createContext, useState } from 'react';
import type { ReactNode } from 'react';

// Interface renomeada para evitar conflito
export interface AppNotification {
  id: number;
  message: string;
  title: string;
  color: 'green' | 'red' | 'blue';
}

interface NotificationContextType {
  notifications: AppNotification[];
  addNotification: (notification: Omit<AppNotification, 'id'>) => void;
  clearNotifications: () => void;
}

export const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  addNotification: () => {},
  clearNotifications: () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const addNotification = (notification: Omit<AppNotification, 'id'>) => {
    const newNotification: AppNotification = {
      id: Date.now(),
      ...notification,
    };
    setNotifications((current) => [newNotification, ...current]);
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, clearNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}