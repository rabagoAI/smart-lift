import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  server: {
    // Expone el dev server en la red local con HTTPS (certificado
    // autofirmado) para poder abrirlo desde el móvil: getUserMedia exige
    // un contexto seguro y no funciona por http:// salvo en localhost.
    host: true,
  },
})
