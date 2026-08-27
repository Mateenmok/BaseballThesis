import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDirectory = path.join(root, 'dist')
const templatePath = path.join(root, 'sites/server.js')
const outputDirectory = path.join(distDirectory, 'server')
const manifestMarker = '"__EMBEDDED_ASSET_MANIFEST__"'

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
])

const textExtensions = new Set(['.css', '.html', '.js', '.json', '.svg', '.txt'])

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (directory === distDirectory && (entry.name === '.openai' || entry.name === 'server')) {
      continue
    }

    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walk(absolutePath))
    } else if (entry.isFile()) {
      files.push(absolutePath)
    }
  }

  return files
}

const manifest = {}
for (const absolutePath of await walk(distDirectory)) {
  const extension = path.extname(absolutePath).toLowerCase()
  const relativePath = path.relative(distDirectory, absolutePath).split(path.sep).join('/')
  const buffer = await fs.readFile(absolutePath)
  const isText = textExtensions.has(extension)

  manifest[`/${relativePath}`] = {
    body: isText ? buffer.toString('utf8') : buffer.toString('base64'),
    contentType: contentTypes.get(extension) ?? 'application/octet-stream',
    encoding: isText ? 'text' : 'base64',
  }
}

if (!manifest['/index.html']) {
  throw new Error('Vite did not emit dist/index.html')
}

const template = await fs.readFile(templatePath, 'utf8')
if (!template.includes(manifestMarker)) {
  throw new Error('Sites worker template is missing the asset manifest marker')
}

const worker = template.replace(manifestMarker, () => JSON.stringify(manifest))
await fs.mkdir(outputDirectory, { recursive: true })
await fs.writeFile(path.join(outputDirectory, 'index.js'), worker)
