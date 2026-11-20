import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// dev-only: lets the page save a canvas capture to .shots/ for visual checks
const shots = {
  name: 'chakra-shots',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__shot', (req, res) => {
      const name = (new URL(req.url, 'http://x').searchParams.get('name') || 'shot').replace(/[^a-z0-9_-]/gi, '')
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => {
        const dir = path.resolve(server.config.root, '.shots')
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(path.join(dir, name + '.jpg'), Buffer.from(body.split(',')[1] || '', 'base64'))
        res.end('ok')
      })
    })
  },
}
export default defineConfig({ plugins: [react(), shots], server: { port: 5173, strictPort: true } })
