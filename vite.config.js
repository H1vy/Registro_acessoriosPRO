import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/Registro_acessoriosPRO/',
  // v1.0.1 - Trigger redeploy
})
