import { copyFile, mkdir } from 'node:fs/promises'

import { build } from 'esbuild'

const outdir = 'dist/homebridge-ui/public'
await mkdir(outdir, { recursive: true })
await copyFile('src/homebridge-ui/public/index.html', `${outdir}/index.html`)
await build({
  bundle: true,
  entryPoints: ['src/ui/main.tsx'],
  format: 'iife',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  minify: true,
  outfile: `${outdir}/app.js`,
  target: 'es2022',
})
