import { PLAYER_PROFILES, type PlayerProfileData } from './playerProfileData'
import { PLAYER_SEASONS, type PlayerSeason } from './playerData'
import { PROFILE_STAT_BY_KEY, PROFILE_STAT_INDEX_BY_KEY } from './profileStats'
import { analyzeRelationship, type RelationshipAnalysis } from './statistics'

export type ExperimentalPercentileMode = 'performance' | 'raw'

export type ExperimentalMetricComponent = {
  statKey: string
  percentileMode: ExperimentalPercentileMode
  displayLabel?: string
  assumption?: string
}

export type ExperimentalMetric = {
  id: string
  name: string
  description: string
  hypothesis: string
  components: readonly ExperimentalMetricComponent[]
}

export type ExperimentalScoreEntry = {
  profile: PlayerProfileData
  player: PlayerSeason
  value: number
  componentPercentiles: readonly number[]
}

export type ExperimentalMetricAnalysis = {
  entries: ExperimentalScoreEntry[]
  analysis: RelationshipAnalysis
}

const performance = (statKey: string): ExperimentalMetricComponent => ({ statKey, percentileMode: 'performance' })

export const EXPERIMENTAL_METRICS: readonly ExperimentalMetric[] = [
  {
    id: 'traditional-leadoff',
    name: 'Traditional Leadoff',
    description: 'Combines batting average, speed, baserunning value, and contact-oriented strikeout avoidance to represent a more traditional leadoff profile.',
    hypothesis: 'Tests whether a traditional mix of hitting, speed, baserunning, and strikeout avoidance is associated with stronger team scoring.',
    components: [
      performance('AVG'),
      { ...performance('SprintSpeed'), displayLabel: 'Sprint Speed' },
      performance('BsR'),
      performance('K%'),
    ],
  },
  {
    id: 'modern-leadoff',
    name: 'Modern Leadoff',
    description: 'Focuses on reaching base and drawing walks, reflecting the modern emphasis on avoiding outs at the top of the lineup.',
    hypothesis: 'Tests whether on-base ability and walk frequency are associated with stronger team scoring.',
    components: [performance('OBP'), performance('BB%')],
  },
  {
    id: 'power-discipline',
    name: 'Power + Discipline',
    description: 'Combines strike-zone discipline with high-quality contact to test whether selective power profiles are associated with stronger team scoring.',
    hypothesis: 'Tests whether hitters who avoid chasing while generating hard, barreled contact are associated with stronger team scoring.',
    components: [
      { ...performance('O-Swing%'), displayLabel: 'Chase%' },
      { ...performance('HardHit%'), displayLabel: 'Hard-Hit%' },
      performance('Barrel%'),
    ],
  },
  {
    id: 'aggressive-run-producer',
    name: 'Aggressive Run Producer',
    description: 'Combines overall offensive production with frequent swinging and sustained contact to represent an aggressive run-producing approach.',
    hypothesis: 'Tests whether frequent swinging paired with contact and strong overall production is associated with stronger team scoring.',
    components: [
      performance('wRC+'),
      {
        statKey: 'Swing%',
        percentileMode: 'raw',
        assumption: 'Higher Swing% contributes positively only within this aggressive run-producing archetype; Swing% remains descriptive elsewhere.',
      },
      performance('Contact%'),
    ],
  },
] as const

export const EXPERIMENTAL_METRIC_BY_ID = new Map(
  EXPERIMENTAL_METRICS.map((metric) => [metric.id, metric]),
)

const playerSeasonByIdentity = new Map(
  PLAYER_SEASONS.flatMap((player) => player.fangraphsId === null
    ? []
    : [[`${player.season}|${player.fangraphsId}`, player] as const]),
)

export function getExperimentalComponentLabel(component: ExperimentalMetricComponent) {
  return component.displayLabel ?? PROFILE_STAT_BY_KEY.get(component.statKey)?.label ?? component.statKey
}

export function calculateExperimentalScore(profile: PlayerProfileData, metric: ExperimentalMetric) {
  const percentiles = metric.components.map((component) => {
    const statIndex = PROFILE_STAT_INDEX_BY_KEY.get(component.statKey)
    if (statIndex === undefined) return null
    const stat = profile.stats[statIndex]
    return component.percentileMode === 'raw' ? stat?.[1] ?? null : stat?.[2] ?? null
  })
  if (percentiles.some((percentile) => percentile === null)) return null
  const validPercentiles = percentiles as number[]
  return {
    value: validPercentiles.reduce((sum, percentile) => sum + percentile, 0) / validPercentiles.length,
    componentPercentiles: validPercentiles,
  }
}

export function getExperimentalMetricAnalysis(
  metric: ExperimentalMetric,
  season: number,
  minimumGames: number,
): ExperimentalMetricAnalysis {
  const entries = PLAYER_PROFILES.flatMap((profile): ExperimentalScoreEntry[] => {
    if (profile.season !== season) return []
    const player = playerSeasonByIdentity.get(`${profile.season}|${profile.playerId}`)
    if (!player) return []
    const games = player.leadoffGames ?? player.games
    if (games < minimumGames) return []
    const score = calculateExperimentalScore(profile, metric)
    if (!score) return []
    return [{ profile, player, ...score }]
  })

  const observations = entries.flatMap(({ player, value }) => {
    const games = player.leadoffGames ?? player.games
    return player.runsPerGameDelta === null
      ? []
      : [{ x: value, y: player.runsPerGameDelta, weight: games }]
  })

  return { entries, analysis: analyzeRelationship(observations) }
}
