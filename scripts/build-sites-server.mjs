import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'sites/server.js')
const outputDirectory = path.join(root, 'dist/server')

await fs.mkdir(outputDirectory, { recursive: true })
await fs.copyFile(source, path.join(outputDirectory, 'index.js'))
