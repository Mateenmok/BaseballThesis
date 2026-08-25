export type AppRoute =
  | { kind: 'analysis' }
  | { kind: 'profile'; playerId: number; season: number }

const PROFILE_PATH = /^\/player\/(\d+)\/(\d{4})\/?$/

export function readAppRoute(pathname = window.location.pathname): AppRoute {
  const match = pathname.match(PROFILE_PATH)
  if (!match) return { kind: 'analysis' }
  return {
    kind: 'profile',
    playerId: Number(match[1]),
    season: Number(match[2]),
  }
}

export function getPlayerProfileHref(playerId: number, season: number) {
  return `/player/${playerId}/${season}`
}
