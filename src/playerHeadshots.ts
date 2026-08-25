export function getPlayerHeadshotUrl(mlbId: number | null) {
  if (!mlbId) return null
  return `https://img.mlbstatic.com/mlb-photos/image/upload/w_180,h_180,c_fill,g_auto,q_auto:best/v1/people/${mlbId}/headshot/67/current`
}
