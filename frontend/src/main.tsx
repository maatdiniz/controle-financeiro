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
import AdicionarPlanilha from './pages/AdicionarPlanilha.tsx';
import EditarGasto from './pages/EditarGasto.tsx';
import Recebimentos from './pages/Recebimentos.tsx';
import FinancasMensais from './pages/FinancasMensais.tsx'; // 1. Importa com o nome correto
import ConciliacaoManual from './pages/ConciliacaoManual.tsx'; // Importa a nova página

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <ListaGastos /> },
      { path: "adicionar", element: <AdicionarGasto /> },
      { path: "editar/:id", element: <EditarGasto /> },
      { path: "recebimentos", element: <Recebimentos /> },
      { path: "faturas", element: <Faturas /> },
      { path: "importar-planilha", element: <AdicionarPlanilha /> },
      { path: "financas-mensais", element: <FinancasMensais /> }, // 2. Adiciona a rota com o nome correto
      { path: "conciliacao-manual", element: <ConciliacaoManual /> }, // Adiciona a nova rota
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