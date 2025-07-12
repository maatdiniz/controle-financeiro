// frontend/src/main.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import '@mantine/core/styles.css';
import { MantineProvider } from '@mantine/core';

import { NotificationProvider } from './context/NotificationContext';
import App from './App.tsx';
import ListaGastos from './pages/ListaGastos.tsx';
import AdicionarGasto from './pages/AdicionarGasto.tsx';
import Faturas from './pages/Faturas.tsx';
import AdicionarPlanilha from './pages/AdicionarPlanilha.tsx'; // 1. Importa com o nome novo

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <ListaGastos /> },
      { path: "adicionar", element: <AdicionarGasto /> },
      { path: "faturas", element: <Faturas /> },
      // 2. A rota agora aponta para o novo nome de ficheiro
      { path: "importar-planilha", element: <AdicionarPlanilha /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider>
      <NotificationProvider>
        <RouterProvider router={router} />
      </NotificationProvider>
    </MantineProvider>
  </React.StrictMode>,
);