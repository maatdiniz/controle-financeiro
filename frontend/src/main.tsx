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

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <ListaGastos /> },
      { path: "adicionar", element: <AdicionarGasto /> },
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