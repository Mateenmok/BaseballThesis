import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PLAYERS_PATH = path.join(ROOT_DIR, 'src/data/generated/players.json')
const TEAMS_PATH = path.join(ROOT_DIR, 'src/data/teams.json')
const OUTPUT_PATH = path.join(ROOT_DIR, 'src/data/generated/leadoff-metrics.json')
const GAME_RESULTS_OUTPUT_PATH = path.join(ROOT_DIR, 'src/data/generated/leadoff-game-results.json')
const TEAM_BASELINES_OUTPUT_PATH = path.join(ROOT_DIR, 'src/data/generated/team-season-runs.json')
const CACHE_DIR = path.join(ROOT_DIR, 'data/cache/mlb')
const API_ROOT = 'https://statsapi.mlb.com/api/v1'
const AGGREGATE_TEAM_PATTERN = /^\d+ Tms$/
const CONCURRENCY = 16
const MAX_ATTEMPTS = 4

const refreshSeasonArgument = process.argv.find((argument) => argument.startsWith('--refresh-season='))
const refreshSeason = refreshSeasonArgument ? Number(refreshSeasonArgument.split('=')[1]) : null

if (refreshSeasonArgument && !Number.isInteger(refreshSeason)) {
  throw new Error(`Invalid refresh season: ${refreshSeasonArgument}`)
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function fetchJson(url, attempt = 1) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })

  if (response.ok) return response.json()
  if (attempt >= MAX_ATTEMPTS || (response.status < 500 && response.status !== 429)) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`)
  }

  await sleep(350 * 2 ** (attempt - 1))
  return fetchJson(url, attempt + 1)
}

async function readCachedJson(cachePath, url, shouldRefresh = false) {
  if (!shouldRefresh) {
    try {
      return JSON.parse(await fs.readFile(cachePath, 'utf8'))
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }

  const data = await fetchJson(url)
  await fs.mkdir(path.dirname(cachePath), { recursive: true })
  await fs.writeFile(cachePath, `${JSON.stringify(data)}\n`)
  return data
}

async function mapWithConcurrency(items, worker) {
  let nextIndex = 0
  let completed = 0

  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++
      await worker(items[index], index)
      completed += 1
      if (completed % 250 === 0 || completed === items.length) {
        console.log(`Boxscores processed: ${completed}/${items.length}`)
      }
    }
  })

  await Promise.all(runners)
}

const [players, teams] = await Promise.all([
  fs.readFile(PLAYERS_PATH, 'utf8').then(JSON.parse),
  fs.readFile(TEAMS_PATH, 'utf8').then(JSON.parse),
])

const teamByCode = new Map()
for (const team of teams) {
  for (const code of [team.abbreviation, ...(team.legacyAbbreviations ?? [])]) {
    teamByCode.set(code, team)
  }
}

const trackedPlayers = new Map()
for (const player of players) {
  if (!player.mlbId || AGGREGATE_TEAM_PATTERN.test(player.team)) continue
  const team = teamByCode.get(player.team)
  if (!team) continue

  const key = `${player.season}|${team.id}|${player.mlbId}`
  trackedPlayers.set(key, {
    season: player.season,
    team: player.team,
    mlbId: player.mlbId,
    games: 0,
    wins: 0,
    losses: 0,
    teamRuns: 0,
  })
}

const seasons = [...new Set(players.map(({ season }) => season))].sort()
const finalGames = []
const teamSeasonTotals = new Map()
const leadoffGameResults = []
const seenGameIds = new Set()

for (const season of seasons) {
  const cachePath = path.join(CACHE_DIR, 'schedules', `${season}.json`)
  const url = `${API_ROOT}/schedule?sportId=1&season=${season}&gameType=R&hydrate=linescore`
  const schedule = await readCachedJson(cachePath, url, season === refreshSeason)

  for (const date of schedule.dates ?? []) {
    for (const game of date.games ?? []) {
      if (game.status?.abstractGameState !== 'Final') continue
      if (!Number.isFinite(game.teams?.home?.score) || !Number.isFinite(game.teams?.away?.score)) continue
      if (seenGameIds.has(game.gamePk)) continue
      seenGameIds.add(game.gamePk)
      finalGames.push({ season, ...game })

      for (const side of ['away', 'home']) {
        const gameTeam = game.teams[side]
        const key = `${season}|${gameTeam.team.id}`
        const total = teamSeasonTotals.get(key) ?? { games: 0, runs: 0, wins: 0, losses: 0 }
        total.games += 1
        total.runs += gameTeam.score
        if (gameTeam.isWinner === true) total.wins += 1
        if (gameTeam.isWinner === false) total.losses += 1
        teamSeasonTotals.set(key, total)
      }
    }
  }
}

console.log(`Final regular-season games found: ${finalGames.length}`)

await mapWithConcurrency(finalGames, async (game) => {
  const cachePath = path.join(CACHE_DIR, 'boxscores-v2', String(game.season), `${game.gamePk}.json`)
  const fields = 'teams,home,away,team,id,players,person,fullName,battingOrder,stats,batting,plateAppearances'
  const url = `${API_ROOT}/game/${game.gamePk}/boxscore?fields=${fields}`
  const boxscore = await readCachedJson(cachePath, url)

  for (const side of ['away', 'home']) {
    const gameTeam = game.teams[side]
    const opponentSide = side === 'away' ? 'home' : 'away'
    const opponentTeam = game.teams[opponentSide]
    const teamId = gameTeam.team.id
    const leadoffPlayers = Object.values(boxscore.teams?.[side]?.players ?? {})
      .filter((player) => player.battingOrder === '100')

    for (const leadoffPlayer of leadoffPlayers) {
      if (!leadoffPlayer.person?.id) continue
      const metric = trackedPlayers.get(`${game.season}|${teamId}|${leadoffPlayer.person.id}`)
      if (!metric) continue

      metric.games += 1
      metric.teamRuns += gameTeam.score
      if (gameTeam.isWinner === true) metric.wins += 1
      if (gameTeam.isWinner === false) metric.losses += 1

      leadoffGameResults.push({
        season: game.season,
        gamePk: game.gamePk,
        date: game.gameDate.slice(0, 10),
        team: metric.team,
        teamId,
        mlbId: leadoffPlayer.person.id,
        opponentTeamId: opponentTeam.team.id,
        homeAway: side,
        teamRuns: gameTeam.score,
        opponentRuns: opponentTeam.score,
        won: gameTeam.isWinner === true,
      })
    }
  }
})

leadoffGameResults.sort((a, b) =>
  b.season - a.season ||
  a.team.localeCompare(b.team) ||
  a.mlbId - b.mlbId ||
  a.date.localeCompare(b.date) ||
  a.gamePk - b.gamePk)

const metrics = [...trackedPlayers.values()]
  .map(({ teamRuns, ...metric }) => ({
    ...metric,
    averageTeamRuns: metric.games > 0 ? Number((teamRuns / metric.games).toFixed(6)) : null,
  }))
  .sort((a, b) => b.season - a.season || a.team.localeCompare(b.team) || a.mlbId - b.mlbId)

const teamSeasons = new Map()
for (const player of players) {
  if (AGGREGATE_TEAM_PATTERN.test(player.team)) continue
  const team = teamByCode.get(player.team)
  if (!team) continue
  teamSeasons.set(`${player.season}|${player.team}`, {
    season: player.season,
    team: player.team,
    teamId: team.id,
  })
}

const teamSeasonRuns = [...teamSeasons.values()]
  .map(({ season, team, teamId }) => {
    const total = teamSeasonTotals.get(`${season}|${teamId}`)
    if (!total?.games) throw new Error(`No final regular-season games found for ${team} ${season}.`)

    return {
      season,
      team,
      games: total.games,
      runs: total.runs,
      runsPerGame: Number((total.runs / total.games).toFixed(6)),
      wins: total.wins,
      losses: total.losses,
      winPercentage: total.wins + total.losses > 0
        ? Number((total.wins / (total.wins + total.losses)).toFixed(6))
        : null,
    }
  })
  .sort((a, b) => b.season - a.season || a.team.localeCompare(b.team))

await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
await Promise.all([
  fs.writeFile(OUTPUT_PATH, `${JSON.stringify(metrics, null, 2)}\n`),
  fs.writeFile(GAME_RESULTS_OUTPUT_PATH, `${JSON.stringify(leadoffGameResults, null, 2)}\n`),
  fs.writeFile(TEAM_BASELINES_OUTPUT_PATH, `${JSON.stringify(teamSeasonRuns, null, 2)}\n`),
])

const rowsWithGames = metrics.filter(({ games }) => games > 0)
const countMismatches = rowsWithGames.filter((metric) => {
  const player = players.find(({ season, team, mlbId }) =>
    season === metric.season && team === metric.team && mlbId === metric.mlbId)
  return player && player.games !== metric.games
})

console.log(`Metric rows emitted: ${metrics.length}`)
console.log(`Rows with matched leadoff games: ${rowsWithGames.length}`)
console.log(`Workbook/API game-count mismatches: ${countMismatches.length}`)
console.log(`Generated: ${path.relative(ROOT_DIR, OUTPUT_PATH)}`)
console.log(`Leadoff game observations emitted: ${leadoffGameResults.length}`)
console.log(`Generated: ${path.relative(ROOT_DIR, GAME_RESULTS_OUTPUT_PATH)}`)
console.log(`Team-season baselines emitted: ${teamSeasonRuns.length}`)
console.log(`Generated: ${path.relative(ROOT_DIR, TEAM_BASELINES_OUTPUT_PATH)}`)
