import generatedProfiles from './data/generated/player-profiles.json'

export type PlayerProfileStat = readonly [
  value: number | null,
  rawPercentile: number | null,
  percentile: number | null,
  referenceCount: number,
]

export type PlayerProfileData = {
  season: number
  playerId: number
  mlbId: number
  name: string
  team: string
  stats: PlayerProfileStat[]
}

export const PLAYER_PROFILES = generatedProfiles as unknown as PlayerProfileData[]

const profileByIdentity = new Map(
  PLAYER_PROFILES.map((profile) => [`${profile.season}|${profile.playerId}`, profile]),
)

export function getPlayerProfile(playerId: number, season: number) {
  return profileByIdentity.get(`${season}|${playerId}`)
}
