import teams from './data/teams.json'

export type Team = {
  id: number
  name: string
  abbreviation: string
  legacyAbbreviations?: string[]
  primaryColor: string
  logo: string
}

export const MLB_TEAMS: readonly Team[] = teams

const teamByAbbreviation = new Map(
  MLB_TEAMS.flatMap((team) =>
    [team.abbreviation, ...(team.legacyAbbreviations ?? [])].map((code) => [code, team] as const)),
)

export function getTeamByAbbreviation(abbreviation: string) {
  return teamByAbbreviation.get(abbreviation)
}

export function getTeamColor(abbreviation: string) {
  return teamByAbbreviation.get(abbreviation)?.primaryColor ?? '#222222'
}

export function getTeamTextColor(abbreviation: string) {
  const color = getTeamColor(abbreviation)
  let channels = color
    .replace('#', '')
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16))

  if (!channels || channels.length !== 3) return '#222222'
  let readableChannels = channels

  const contrastOnWhite = () => {
    const linear = readableChannels.map((channel) => {
      const normalized = channel / 255
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4
    })
    const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
    return 1.05 / (luminance + 0.05)
  }

  while (contrastOnWhite() < 4.5) {
    readableChannels = readableChannels.map((channel) => Math.round(channel * 0.88))
  }

  return `#${readableChannels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

export function getTextColorOnTeamColor(abbreviation: string) {
  const channels = getTeamColor(abbreviation)
    .replace('#', '')
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)

  if (!channels || channels.length !== 3) return '#ffffff'
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  const whiteContrast = 1.05 / (luminance + 0.05)
  const blackContrast = (luminance + 0.05) / 0.05
  return whiteContrast >= blackContrast ? '#ffffff' : '#000000'
}

export const SEASONS = [2026, 2025, 2024, 2023] as const

export type TeamName = string
export type Season = (typeof SEASONS)[number]
