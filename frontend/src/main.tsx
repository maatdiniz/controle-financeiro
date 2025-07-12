// frontend/src/main.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import '@mantine/core/styles.css';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

// Importa nossos componentes
import App from './App.tsx';
import ListaGastos from './pages/ListaGastos.tsx';
import AdicionarGasto from './pages/AdicionarGasto.tsx';

// Criação do roteador
const router = createBrowserRouter([
  {
    path: "/",
    element: <App />, // O App será o "molde" geral da página
    children: [
      {
        index: true, // A rota inicial (/) vai renderizar a lista
        element: <ListaGastos />,
      },
      {
        path: "adicionar", // A rota /adicionar vai renderizar o formulário
        element: <AdicionarGasto />,
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider>
      <Notifications /> {/* 2. Adicione o componente aqui */}
      <RouterProvider router={router} />
    </MantineProvider>
  </React.StrictMode>,
);