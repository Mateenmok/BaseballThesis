import generatedGameResults from './data/generated/leadoff-game-results.json'
import { PLAYER_SEASONS, type PlayerSeason } from './playerData'
import { getPlayerProfile } from './playerProfileData'
import { PROFILE_STAT_INDEX_BY_KEY } from './profileStats'

export const MIN_SWAP_LEADOFF_GAMES = 40
export const MIN_PROFILE_DISTANCE = 25
export const MIN_COMPONENT_GAP = 25
export const MIN_LARGE_COMPONENT_GAPS = 2
export const SWAP_RESAMPLING_ITERATIONS = 10_000

export const SWAP_PROFILE_DIMENSIONS = [
  { statKey: 'OBP', label: 'OBP' },
  { statKey: 'ISO', label: 'ISO' },
  { statKey: 'BB%', label: 'BB%' },
  { statKey: 'Contact%', label: 'Contact%' },
  { statKey: 'HardHit%', label: 'Hard-Hit%' },
  { statKey: 'SprintSpeed', label: 'Sprint Speed' },
] as const

export type SwapProfileDimension = (typeof SWAP_PROFILE_DIMENSIONS)[number]

export type SwapPlayer = PlayerSeason & {
  fangraphsId: number
  mlbId: number
  leadoffGames: number
  teamWins: number
  teamLosses: number
  teamRunsPerGame: number
  teamSeasonRunsPerGame: number
  runsPerGameDelta: number
  teamWinPercentage: number
  teamSeasonWinPercentage: number
  winPercentageDelta: number
  profilePercentiles: readonly number[]
}

export type SwapGameLevelInference = {
  gamesA: number
  gamesB: number
  bootstrapLow: number
  bootstrapHigh: number
  permutationPValue: number
  iterations: number
}

export type LeadoffSwapPair = {
  id: string
  season: number
  team: string
  playerA: SwapPlayer
  playerB: SwapPlayer
  componentGaps: readonly number[]
  largeComponentGapCount: number
  profileDistance: number
  runsPerGameDifference: number
  winPercentageDifference: number
  inference: SwapGameLevelInference | null
}

type GameResult = {
  season: string | number
  gamePk: number
  team: string
  mlbId: number
  teamRuns: number
  won: boolean
}

const gameResults = generatedGameResults as GameResult[]
const runsByPlayerSeason = new Map<string, number[]>()

for (const game of gameResults) {
  const key = `${Number(game.season)}|${game.team}|${game.mlbId}`
  const runs = runsByPlayerSeason.get(key) ?? []
  runs.push(game.teamRuns)
  runsByPlayerSeason.set(key, runs)
}

function isCompleteSwapPlayer(player: PlayerSeason): player is SwapPlayer {
  return (
    player.fangraphsId !== null &&
    player.mlbId !== null &&
    player.leadoffGames !== null &&
    player.leadoffGames >= MIN_SWAP_LEADOFF_GAMES &&
    player.teamWins !== null &&
    player.teamLosses !== null &&
    player.teamRunsPerGame !== null &&
    player.teamSeasonRunsPerGame !== null &&
    player.runsPerGameDelta !== null &&
    player.teamWinPercentage !== null &&
    player.teamSeasonWinPercentage !== null &&
    player.winPercentageDelta !== null
  )
}

function getProfilePercentiles(player: PlayerSeason) {
  if (player.fangraphsId === null) return null
  const profile = getPlayerProfile(player.fangraphsId, player.season)
  if (!profile) return null

  const percentiles = SWAP_PROFILE_DIMENSIONS.map(({ statKey }) => {
    const statIndex = PROFILE_STAT_INDEX_BY_KEY.get(statKey)
    return statIndex === undefined ? null : profile.stats[statIndex]?.[1] ?? null
  })

  return percentiles.every((percentile): percentile is number => percentile !== null)
    ? percentiles
    : null
}

export function calculateProfileDistance(
  percentilesA: readonly number[],
  percentilesB: readonly number[],
) {
  if (percentilesA.length !== percentilesB.length || percentilesA.length === 0) {
    throw new Error('Profile vectors must have the same non-zero length.')
  }

  const squaredDistance = percentilesA.reduce((sum, percentile, index) => {
    const difference = percentile - percentilesB[index]
    return sum + difference ** 2
  }, 0)

  return Math.sqrt(squaredDistance / percentilesA.length)
}

function average(values: readonly number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function hashSeed(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function quantile(sortedValues: readonly number[], probability: number) {
  const position = (sortedValues.length - 1) * probability
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)
  const weight = position - lowerIndex
  return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight
}

function buildGameLevelInference(
  pairId: string,
  playerA: SwapPlayer,
  playerB: SwapPlayer,
): SwapGameLevelInference | null {
  const runsA = runsByPlayerSeason.get(`${playerA.season}|${playerA.team}|${playerA.mlbId}`)
  const runsB = runsByPlayerSeason.get(`${playerB.season}|${playerB.team}|${playerB.mlbId}`)
  if (!runsA || !runsB) return null

  const aggregateTolerance = 0.000_001
  const aggregatesMatch = (
    runsA.length === playerA.leadoffGames &&
    runsB.length === playerB.leadoffGames &&
    Math.abs(average(runsA) - playerA.teamRunsPerGame) <= aggregateTolerance &&
    Math.abs(average(runsB) - playerB.teamRunsPerGame) <= aggregateTolerance
  )
  if (!aggregatesMatch) return null

  const bootstrapRandom = createSeededRandom(hashSeed(`${pairId}|bootstrap`))
  const bootstrapDifferences = new Array<number>(SWAP_RESAMPLING_ITERATIONS)
  for (let iteration = 0; iteration < SWAP_RESAMPLING_ITERATIONS; iteration += 1) {
    let totalA = 0
    let totalB = 0
    for (let index = 0; index < runsA.length; index += 1) {
      totalA += runsA[Math.floor(bootstrapRandom() * runsA.length)]
    }
    for (let index = 0; index < runsB.length; index += 1) {
      totalB += runsB[Math.floor(bootstrapRandom() * runsB.length)]
    }
    bootstrapDifferences[iteration] = totalA / runsA.length - totalB / runsB.length
  }
  bootstrapDifferences.sort((a, b) => a - b)

  const observedDifference = average(runsA) - average(runsB)
  const pooledRuns = [...runsA, ...runsB]
  const permutationRandom = createSeededRandom(hashSeed(`${pairId}|permutation`))
  let atLeastAsExtreme = 0

  for (let iteration = 0; iteration < SWAP_RESAMPLING_ITERATIONS; iteration += 1) {
    const shuffled = [...pooledRuns]
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(permutationRandom() * (index + 1))
      const held = shuffled[index]
      shuffled[index] = shuffled[swapIndex]
      shuffled[swapIndex] = held
    }

    let totalA = 0
    let totalB = 0
    for (let index = 0; index < runsA.length; index += 1) totalA += shuffled[index]
    for (let index = runsA.length; index < shuffled.length; index += 1) totalB += shuffled[index]
    const difference = totalA / runsA.length - totalB / runsB.length
    if (Math.abs(difference) >= Math.abs(observedDifference) - Number.EPSILON) {
      atLeastAsExtreme += 1
    }
  }

  return {
    gamesA: runsA.length,
    gamesB: runsB.length,
    bootstrapLow: quantile(bootstrapDifferences, 0.025),
    bootstrapHigh: quantile(bootstrapDifferences, 0.975),
    permutationPValue: (atLeastAsExtreme + 1) / (SWAP_RESAMPLING_ITERATIONS + 1),
    iterations: SWAP_RESAMPLING_ITERATIONS,
  }
}

const pairsBySeason = new Map<number, LeadoffSwapPair[]>()

export function getLeadoffSwapPairs(season: number) {
  const cached = pairsBySeason.get(season)
  if (cached) return cached

  const playersByTeam = new Map<string, SwapPlayer[]>()
  for (const player of PLAYER_SEASONS) {
    if (player.season !== season || !isCompleteSwapPlayer(player)) continue
    const profilePercentiles = getProfilePercentiles(player)
    if (!profilePercentiles) continue

    const swapPlayer = { ...player, profilePercentiles }
    const teamPlayers = playersByTeam.get(player.team) ?? []
    teamPlayers.push(swapPlayer)
    playersByTeam.set(player.team, teamPlayers)
  }

  const pairs: LeadoffSwapPair[] = []
  for (const [team, teamPlayers] of playersByTeam) {
    teamPlayers.sort((a, b) => a.fangraphsId - b.fangraphsId)
    for (let firstIndex = 0; firstIndex < teamPlayers.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < teamPlayers.length; secondIndex += 1) {
        const playerA = teamPlayers[firstIndex]
        const playerB = teamPlayers[secondIndex]
        const componentGaps = playerA.profilePercentiles.map((value, index) =>
          Math.abs(value - playerB.profilePercentiles[index]))
        const largeComponentGapCount = componentGaps.filter((gap) => gap >= MIN_COMPONENT_GAP).length
        const profileDistance = calculateProfileDistance(
          playerA.profilePercentiles,
          playerB.profilePercentiles,
        )

        if (
          profileDistance < MIN_PROFILE_DISTANCE ||
          largeComponentGapCount < MIN_LARGE_COMPONENT_GAPS
        ) continue

        const id = `${season}|${team}|${playerA.fangraphsId}|${playerB.fangraphsId}`
        pairs.push({
          id,
          season,
          team,
          playerA,
          playerB,
          componentGaps,
          largeComponentGapCount,
          profileDistance,
          runsPerGameDifference: playerA.teamRunsPerGame - playerB.teamRunsPerGame,
          winPercentageDifference: playerA.teamWinPercentage - playerB.teamWinPercentage,
          inference: buildGameLevelInference(id, playerA, playerB),
        })
      }
    }
  }

  pairs.sort((a, b) =>
    Math.abs(b.runsPerGameDifference) - Math.abs(a.runsPerGameDifference) ||
    a.team.localeCompare(b.team) ||
    a.playerA.fangraphsId - b.playerA.fangraphsId ||
    a.playerB.fangraphsId - b.playerB.fangraphsId)
  pairsBySeason.set(season, pairs)
  return pairs
}

