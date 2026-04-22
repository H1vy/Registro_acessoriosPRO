import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  // v1.0.2 - Force push to fix GH Pages blank screen
})
