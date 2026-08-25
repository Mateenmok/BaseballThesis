import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import profileConfig from '../src/data/profile-stats.json' with { type: 'json' }
import { midrankPercentile, performancePercentile } from './percentiles.mjs'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LEADOFF_PATH = path.join(ROOT_DIR, 'data/master/2023to2026Leadoff_Canonical.csv')
const QUALIFIED_PATH = path.join(ROOT_DIR, 'data/master/2023to2026Qualified_Canonical.csv')
const OUTPUT_PATH = path.join(ROOT_DIR, 'src/data/generated/player-profiles.json')
const IDENTITY_HEADERS = ['Season', 'Name', 'Tm', 'playerId', 'MLBAMID']

function parseCsv(source) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  const text = source.replace(/^\uFEFF/, '')

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
    } else if (character === '"') {
      quoted = true
    } else if (character === ',') {
      row.push(field)
      field = ''
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''))
      if (row.some((value) => value !== '')) rows.push(row)
      row = []
      field = ''
    } else {
      field += character
    }
  }

  if (quoted) throw new Error('CSV ended inside a quoted field.')
  if (field !== '' || row.length > 0) {
    row.push(field.replace(/\r$/, ''))
    if (row.some((value) => value !== '')) rows.push(row)
  }

  const [headers, ...dataRows] = rows
  if (!headers) return { headers: [], records: [] }
  return {
    headers,
    records: dataRows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))),
  }
}

function requireHeaders(label, headers, requiredHeaders) {
  const missing = requiredHeaders.filter((header) => !headers.includes(header))
  if (missing.length > 0) throw new Error(`${label} is missing required columns: ${missing.join(', ')}`)
}

function requiredInteger(value, label) {
  const number = Number(value)
  if (!Number.isInteger(number)) throw new Error(`${label} must be an integer; received ${value}.`)
  return number
}

function nullableNumber(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function assertUniqueIdentities(label, records) {
  const seen = new Set()
  for (const record of records) {
    const key = `${record.Season}|${record.playerId}`
    if (seen.has(key)) throw new Error(`${label} contains duplicate Season + playerId identity ${key}.`)
    seen.add(key)
  }
}

const [leadoffSource, qualifiedSource] = await Promise.all([
  fs.readFile(LEADOFF_PATH, 'utf8'),
  fs.readFile(QUALIFIED_PATH, 'utf8'),
])
const leadoff = parseCsv(leadoffSource)
const qualified = parseCsv(qualifiedSource)
const statHeaders = profileConfig.stats.map(({ key }) => key)
const requiredHeaders = [...IDENTITY_HEADERS, ...statHeaders]

requireHeaders('Leadoff canonical CSV', leadoff.headers, requiredHeaders)
requireHeaders('Qualified canonical CSV', qualified.headers, requiredHeaders)
assertUniqueIdentities('Leadoff canonical CSV', leadoff.records)
assertUniqueIdentities('Qualified canonical CSV', qualified.records)

const referenceBySeasonAndStat = new Map()
for (const record of qualified.records) {
  const season = requiredInteger(record.Season, 'Qualified Season')
  for (const stat of profileConfig.stats) {
    const value = nullableNumber(record[stat.key])
    if (value === null) continue
    const key = `${season}|${stat.key}`
    const values = referenceBySeasonAndStat.get(key) ?? []
    values.push(value)
    referenceBySeasonAndStat.set(key, values)
  }
}

for (const values of referenceBySeasonAndStat.values()) values.sort((a, b) => a - b)

const profiles = leadoff.records.map((record) => {
  const season = requiredInteger(record.Season, 'Leadoff Season')
  const playerId = requiredInteger(record.playerId, 'Leadoff playerId')
  const mlbId = requiredInteger(record.MLBAMID, 'Leadoff MLBAMID')
  const stats = profileConfig.stats.map((stat) => {
    const value = nullableNumber(record[stat.key])
    const referenceValues = referenceBySeasonAndStat.get(`${season}|${stat.key}`) ?? []
    const rawPercentile = value === null ? null : midrankPercentile(value, referenceValues)
    return [
      value,
      rawPercentile,
      performancePercentile(rawPercentile, stat.direction),
      referenceValues.length,
    ]
  })

  return {
    season,
    playerId,
    mlbId,
    name: record.Name.trim(),
    team: record.Tm.trim(),
    stats,
  }
})

profiles.sort((a, b) => b.season - a.season || a.name.localeCompare(b.name))

await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(profiles, null, 2)}\n`)

console.log(`Leadoff rows: ${leadoff.records.length}`)
console.log(`Qualified rows: ${qualified.records.length}`)
console.log(`Player profiles generated: ${profiles.length}`)
console.log(`Statistics per profile: ${profileConfig.stats.length}`)
console.log(`Generated: ${path.relative(ROOT_DIR, OUTPUT_PATH)}`)
