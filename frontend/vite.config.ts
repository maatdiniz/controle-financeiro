// frontend/vite.config.ts

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Esta linha é a mágica:
      // Ela diz ao Vite para, sempre que encontrar um import de '@tabler/icons-react',
      // usar um ficheiro específico que é otimizado para que apenas os ícones
      // que realmente usamos sejam carregados.
      '@tabler/icons-react': '@tabler/icons-react/dist/esm/icons/index.mjs',
    }
  }
})