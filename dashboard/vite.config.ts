import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'fs'
import { resolve } from 'path'

function copyDataPlugin() {
  return {
    name: 'copy-data-dir',
    closeBundle() {
      const srcDir = resolve(__dirname, '../data')
      const destDir = resolve(__dirname, 'dist/data')
      if (!existsSync(srcDir)) return
      mkdirSync(destDir, { recursive: true })
      const ALLOWED = new Set(['usage.json', 'history.json'])
      for (const file of readdirSync(srcDir)) {
        if (!ALLOWED.has(file)) continue   // skip *.tmp and any other orphans
        copyFileSync(resolve(srcDir, file), resolve(destDir, file))
      }
      console.log('✓ data/ copied to dist/data/')
    },
  }
}

export default defineConfig({
  plugins: [tailwindcss(), react(), copyDataPlugin()],
  base: '/claude-pulse/',
})
