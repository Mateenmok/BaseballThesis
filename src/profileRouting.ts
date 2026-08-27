export type AppRoute =
  | { kind: 'analysis' }
  | { kind: 'profile'; playerId: number; season: number }
  | { kind: 'stat-leaderboard'; statKey: string; season: number }
  | { kind: 'experimental'; season: number; metricId?: string }
  | { kind: 'swaps'; season: number }

const PROFILE_PATH = /^\/player\/(\d+)\/(\d{4})\/?$/
const STAT_LEADERBOARD_PATH = /^\/stats\/(\d{4})\/([^/]+)\/?$/
const EXPERIMENTAL_DETAIL_PATH = /^\/experimental\/(\d{4})\/([^/]+)\/?$/
const EXPERIMENTAL_OVERVIEW_PATH = /^\/experimental(?:\/(\d{4}))?\/?$/
const LEADOFF_SWAPS_PATH = /^\/swaps(?:\/(\d{4}))?\/?$/

export function readAppRoute(pathname = window.location.pathname): AppRoute {
  const leadoffSwapsMatch = pathname.match(LEADOFF_SWAPS_PATH)
  if (leadoffSwapsMatch) {
    return { kind: 'swaps', season: Number(leadoffSwapsMatch[1] ?? 2026) }
  }

  const experimentalDetailMatch = pathname.match(EXPERIMENTAL_DETAIL_PATH)
  if (experimentalDetailMatch) {
    return {
      kind: 'experimental',
      season: Number(experimentalDetailMatch[1]),
      metricId: decodeURIComponent(experimentalDetailMatch[2]),
    }
  }

  const experimentalOverviewMatch = pathname.match(EXPERIMENTAL_OVERVIEW_PATH)
  if (experimentalOverviewMatch) {
    return { kind: 'experimental', season: Number(experimentalOverviewMatch[1] ?? 2026) }
  }

  const profileMatch = pathname.match(PROFILE_PATH)
  if (profileMatch) {
    return {
      kind: 'profile',
      playerId: Number(profileMatch[1]),
      season: Number(profileMatch[2]),
    }
  }

  const leaderboardMatch = pathname.match(STAT_LEADERBOARD_PATH)
  if (leaderboardMatch) {
    try {
      return {
        kind: 'stat-leaderboard',
        season: Number(leaderboardMatch[1]),
        statKey: decodeURIComponent(leaderboardMatch[2]),
      }
    } catch {
      return { kind: 'analysis' }
    }
  }

  return { kind: 'analysis' }
}

export function getPlayerProfileHref(playerId: number, season: number) {
  return `/player/${playerId}/${season}`
}

export function getStatisticLeaderboardHref(statKey: string, season: number) {
  return `/stats/${season}/${encodeURIComponent(statKey)}`
}

export function getExperimentalOverviewHref(season: number) {
  return `/experimental/${season}`
}

export function getExperimentalMetricHref(metricId: string, season: number) {
  return `/experimental/${season}/${encodeURIComponent(metricId)}`
}

export function getLeadoffSwapHref(season: number) {
  return `/swaps/${season}`
}
