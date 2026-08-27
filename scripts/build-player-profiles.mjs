import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import profileConfig from '../src/data/profile-stats.json' with { type: 'json' }
import { midrankPercentile, performancePercentile } from './percentiles.mjs'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LEADOFF_PATH = path.join(ROOT_DIR, 'data/master/2023to2026Leadoff_Canonical.csv')
const QUALIFIED_PATH = path.join(ROOT_DIR, 'data/master/2023to2026Qualified_Canonical.csv')
const SPRINT_SPEED_DIR = path.join(ROOT_DIR, 'data/master/sprint-speed')
const BSR_DIR = path.join(ROOT_DIR, 'data/master/bsr')
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
const sprintSpeedBySeasonAndPlayer = new Map()
const sprintSpeedFiles = (await fs.readdir(SPRINT_SPEED_DIR))
  .filter((fileName) => /^\d{4}\.csv$/.test(fileName))
  .sort()

for (const fileName of sprintSpeedFiles) {
  const season = requiredInteger(path.basename(fileName, '.csv'), 'Sprint Speed season')
  const sprintSpeed = parseCsv(await fs.readFile(path.join(SPRINT_SPEED_DIR, fileName), 'utf8'))
  requireHeaders(`Sprint Speed ${season}`, sprintSpeed.headers, ['player_id', 'sprint_speed'])

  for (const record of sprintSpeed.records) {
    const playerId = requiredInteger(record.player_id, `Sprint Speed ${season} player_id`)
    const value = nullableNumber(record.sprint_speed)
    if (value === null) continue
    const key = `${season}|${playerId}`
    if (sprintSpeedBySeasonAndPlayer.has(key)) {
      throw new Error(`Sprint Speed contains duplicate Season + player_id identity ${key}.`)
    }
    sprintSpeedBySeasonAndPlayer.set(key, value)
  }
}

const bsrBySeasonAndPlayer = new Map()
const bsrFiles = (await fs.readdir(BSR_DIR))
  .filter((fileName) => /^\d{4}\.csv$/.test(fileName))
  .sort()

for (const fileName of bsrFiles) {
  const season = requiredInteger(path.basename(fileName, '.csv'), 'BsR season')
  const bsr = parseCsv(await fs.readFile(path.join(BSR_DIR, fileName), 'utf8'))
  requireHeaders(`BsR ${season}`, bsr.headers, ['PlayerId', 'BsR'])

  for (const record of bsr.records) {
    const playerId = requiredInteger(record.PlayerId, `BsR ${season} PlayerId`)
    const value = nullableNumber(record.BsR)
    if (value === null) continue
    const key = `${season}|${playerId}`
    if (bsrBySeasonAndPlayer.has(key)) {
      throw new Error(`BsR contains duplicate Season + PlayerId identity ${key}.`)
    }
    bsrBySeasonAndPlayer.set(key, value)
  }
}

const statHeaders = profileConfig.stats
  .filter(({ externalSource }) => !externalSource)
  .map(({ key }) => key)
const requiredHeaders = [...IDENTITY_HEADERS, ...statHeaders]

requireHeaders('Leadoff canonical CSV', leadoff.headers, requiredHeaders)
requireHeaders('Qualified canonical CSV', qualified.headers, requiredHeaders)
assertUniqueIdentities('Leadoff canonical CSV', leadoff.records)
assertUniqueIdentities('Qualified canonical CSV', qualified.records)

function statValue(record, season, stat) {
  if (stat.externalSource === 'sprintSpeed') {
    const mlbId = requiredInteger(record.MLBAMID, `${record.Name} MLBAMID`)
    return sprintSpeedBySeasonAndPlayer.get(`${season}|${mlbId}`) ?? null
  }
  if (stat.externalSource === 'bsr') {
    const playerId = requiredInteger(record.playerId, `${record.Name} playerId`)
    return bsrBySeasonAndPlayer.get(`${season}|${playerId}`) ?? null
  }
  return nullableNumber(record[stat.key])
}

const referenceBySeasonAndStat = new Map()
for (const record of qualified.records) {
  const season = requiredInteger(record.Season, 'Qualified Season')
  for (const stat of profileConfig.stats) {
    const value = statValue(record, season, stat)
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
    const value = statValue(record, season, stat)
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
console.log(`Sprint Speed files: ${sprintSpeedFiles.length}`)
console.log(`Sprint Speed player-seasons: ${sprintSpeedBySeasonAndPlayer.size}`)
console.log(`BsR files: ${bsrFiles.length}`)
console.log(`BsR player-seasons: ${bsrBySeasonAndPlayer.size}`)
console.log(`Generated: ${path.relative(ROOT_DIR, OUTPUT_PATH)}`)
