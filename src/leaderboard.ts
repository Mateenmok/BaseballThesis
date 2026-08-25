import type { Season } from './data'
import type { PlayerSeason } from './playerData'

export const MIN_LEADOFF_GAMES = 20
export const LEADERBOARD_LIMIT = 20

export type LeaderboardMetric = 'runsPerGame' | 'winPercentage' | 'runsPerGameDelta'

export type LeaderboardEntry = PlayerSeason & {
  leadoffGames: number
  teamWins: number
  teamLosses: number
  teamRunsPerGame: number
  teamSeasonRunsPerGame: number
  runsPerGameDelta: number
  winPercentage: number
}

export function getTeamWinPercentage(player: PlayerSeason) {
  if (player.teamWins === null || player.teamLosses === null) return null
  const decisions = player.teamWins + player.teamLosses
  return decisions > 0 ? player.teamWins / decisions : null
}

export function getLeagueLeaders(
  players: readonly PlayerSeason[],
  season: Season,
  metric: LeaderboardMetric,
): LeaderboardEntry[] {
  return getQualifiedLeadoffHitters(players, season)
    .sort((a, b) => {
      const metricDifference = metric === 'runsPerGame'
        ? b.teamRunsPerGame - a.teamRunsPerGame
        : metric === 'runsPerGameDelta'
          ? b.runsPerGameDelta - a.runsPerGameDelta
          : b.winPercentage - a.winPercentage

      return metricDifference || b.leadoffGames - a.leadoffGames || a.name.localeCompare(b.name)
    })
    .slice(0, LEADERBOARD_LIMIT)
}

export function getQualifiedLeadoffHitters(
  players: readonly PlayerSeason[],
  season: Season,
): LeaderboardEntry[] {
  return players
    .filter((player): player is LeaderboardEntry => {
      const winPercentage = getTeamWinPercentage(player)
      return (
        player.season === season &&
        player.leadoffGames !== null &&
        player.leadoffGames >= MIN_LEADOFF_GAMES &&
        player.teamWins !== null &&
        player.teamLosses !== null &&
        player.teamRunsPerGame !== null &&
        player.teamSeasonRunsPerGame !== null &&
        player.runsPerGameDelta !== null &&
        winPercentage !== null
      )
    })
    .map((player) => ({
      ...player,
      winPercentage: getTeamWinPercentage(player) as number,
    }))
}

export function formatWinningPercentage(value: number) {
  return value.toFixed(3).replace(/^0/, '')
}

export function formatRunsPerGameDelta(value: number) {
  if (Math.abs(value) < 0.005) return '0.00'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`
}
