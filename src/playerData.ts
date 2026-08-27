import generatedPlayers from './data/generated/players.json'
import generatedLeadoffMetrics from './data/generated/leadoff-metrics.json'
import generatedTeamSeasonRuns from './data/generated/team-season-runs.json'

export type PlayerSeason = {
  season: number
  name: string
  team: string
  games: number
  plateAppearances: number
  fangraphsId: number | null
  mlbId: number | null
  leadoffGames: number | null
  teamWins: number | null
  teamLosses: number | null
  teamRunsPerGame: number | null
  teamSeasonRunsPerGame: number | null
  runsPerGameDelta: number | null
  teamWinPercentage: number | null
  teamSeasonWinPercentage: number | null
  winPercentageDelta: number | null
}

const metricByPlayer = new Map(
  generatedLeadoffMetrics.map((metric) => [
    `${metric.season}|${metric.team}|${metric.mlbId}`,
    metric,
  ]),
)

const baselineByTeamSeason = new Map(
  generatedTeamSeasonRuns.map((baseline) => [
    `${baseline.season}|${baseline.team}`,
    baseline,
  ]),
)

export const PLAYER_SEASONS: PlayerSeason[] = generatedPlayers.map((player) => {
  const metric = player.mlbId
    ? metricByPlayer.get(`${player.season}|${player.team}|${player.mlbId}`)
    : undefined
  const baseline = baselineByTeamSeason.get(`${player.season}|${player.team}`)
  const teamRunsPerGame = metric?.averageTeamRuns ?? null
  const teamSeasonRunsPerGame = baseline?.runsPerGame ?? null
  const teamDecisions = metric ? metric.wins + metric.losses : 0
  const teamWinPercentage = metric && teamDecisions > 0 ? metric.wins / teamDecisions : null
  const teamSeasonWinPercentage = baseline?.winPercentage ?? null

  return {
    ...player,
    leadoffGames: metric?.games ?? null,
    teamWins: metric?.wins ?? null,
    teamLosses: metric?.losses ?? null,
    teamRunsPerGame,
    teamSeasonRunsPerGame,
    runsPerGameDelta: teamRunsPerGame !== null && teamSeasonRunsPerGame !== null
      ? teamRunsPerGame - teamSeasonRunsPerGame
      : null,
    teamWinPercentage,
    teamSeasonWinPercentage,
    winPercentageDelta: teamWinPercentage !== null && teamSeasonWinPercentage !== null
      ? teamWinPercentage - teamSeasonWinPercentage
      : null,
  }
})
