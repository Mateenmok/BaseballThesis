import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import readExcelFile from 'read-excel-file/node'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WORKBOOK_PATH = path.join(ROOT_DIR, 'data/master/player-data.xlsx')
const TEAM_CONFIG_PATH = path.join(ROOT_DIR, 'src/data/teams.json')
const OUTPUT_PATH = path.join(ROOT_DIR, 'src/data/generated/players.json')
const SHEET_NAME = 'Combined Data'
const REQUIRED_HEADERS = ['Season', 'Name', 'Tm', 'PA', 'playerId', 'MLBAMID', 'G']
const AGGREGATE_TEAM_PATTERN = /^\d+ Tms$/

const isBlank = (value) => value === null || value === undefined || String(value).trim() === ''

function requiredText(value, field, rowNumber) {
  if (isBlank(value)) throw new Error(`Row ${rowNumber}: ${field} is required.`)
  return String(value).trim()
}

function requiredInteger(value, field, rowNumber) {
  if (isBlank(value)) throw new Error(`Row ${rowNumber}: ${field} is required.`)
  const number = Number(value)
  if (!Number.isInteger(number)) throw new Error(`Row ${rowNumber}: ${field} must be an integer; received ${value}.`)
  return number
}

function nullableInteger(value, field, rowNumber) {
  if (isBlank(value)) return null
  const number = Number(value)
  if (!Number.isInteger(number)) throw new Error(`Row ${rowNumber}: ${field} must be an integer or blank; received ${value}.`)
  return number
}

const sheets = await readExcelFile(WORKBOOK_PATH)
const sourceSheet = sheets.find(({ sheet }) => sheet === SHEET_NAME)

if (!sourceSheet) {
  throw new Error(`Worksheet "${SHEET_NAME}" was not found. Available sheets: ${sheets.map(({ sheet }) => sheet).join(', ')}`)
}

const [rawHeaders = [], ...rawRows] = sourceSheet.data
const headers = rawHeaders.map((value) => String(value ?? '').trim())
const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header))

if (missingHeaders.length > 0) {
  throw new Error(`Missing required columns in "${SHEET_NAME}": ${missingHeaders.join(', ')}`)
}

const column = Object.fromEntries(REQUIRED_HEADERS.map((header) => [header, headers.indexOf(header)]))
const sourceRows = rawRows.filter((row) => row.some((value) => !isBlank(value)))
const players = sourceRows.map((row, index) => {
  const rowNumber = index + 2

  return {
    season: requiredInteger(row[column.Season], 'Season', rowNumber),
    name: requiredText(row[column.Name], 'Name', rowNumber),
    team: requiredText(row[column.Tm], 'Tm', rowNumber),
    games: requiredInteger(row[column.G], 'G', rowNumber),
    plateAppearances: requiredInteger(row[column.PA], 'PA', rowNumber),
    fangraphsId: nullableInteger(row[column.playerId], 'playerId', rowNumber),
    mlbId: nullableInteger(row[column.MLBAMID], 'MLBAMID', rowNumber),
  }
})

const duplicateIdentities = new Map()
for (const player of players) {
  const stableId = player.mlbId ?? `fg:${player.fangraphsId ?? `name:${player.name}`}`
  const key = `${player.season}|${player.team}|${stableId}`
  duplicateIdentities.set(key, (duplicateIdentities.get(key) ?? 0) + 1)
}

const duplicates = [...duplicateIdentities.entries()].filter(([, count]) => count > 1)
if (duplicates.length > 0) {
  throw new Error(`Duplicate player/team/season identities found: ${duplicates.slice(0, 10).map(([key, count]) => `${key} (${count} rows)`).join(', ')}`)
}

const teamConfig = JSON.parse(await fs.readFile(TEAM_CONFIG_PATH, 'utf8'))
const mappedTeamCodes = new Set(teamConfig.flatMap(({ abbreviation, legacyAbbreviations = [] }) => [abbreviation, ...legacyAbbreviations]))
const workbookTeamCodes = [...new Set(players.map(({ team }) => team))].sort()
const aggregateTeamCodes = workbookTeamCodes.filter((team) => AGGREGATE_TEAM_PATTERN.test(team))
const selectableWorkbookCodes = workbookTeamCodes.filter((team) => !AGGREGATE_TEAM_PATTERN.test(team))
const unmappedTeamCodes = selectableWorkbookCodes.filter((team) => !mappedTeamCodes.has(team))

if (unmappedTeamCodes.length > 0) {
  throw new Error(`Workbook team values missing from src/data/teams.json: ${unmappedTeamCodes.join(', ')}`)
}

players.sort((a, b) =>
  b.season - a.season ||
  a.team.localeCompare(b.team) ||
  b.plateAppearances - a.plateAppearances ||
  a.name.localeCompare(b.name),
)

await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(players, null, 2)}\n`)

console.log(`Workbook: ${path.relative(ROOT_DIR, WORKBOOK_PATH)}`)
console.log(`Worksheet: ${SHEET_NAME}`)
console.log(`Rows read: ${sourceRows.length}`)
console.log(`Rows emitted: ${players.length}`)
console.log(`Seasons found: ${[...new Set(players.map(({ season }) => season))].sort().join(', ')}`)
console.log(`Teams found: ${selectableWorkbookCodes.join(', ')}`)
console.log(`Aggregate team rows retained but not selectable: ${aggregateTeamCodes.join(', ') || 'none'}`)
console.log(`Generated: ${path.relative(ROOT_DIR, OUTPUT_PATH)}`)
