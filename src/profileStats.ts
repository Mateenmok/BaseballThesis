import type { CSSProperties } from 'react'
import rawProfileConfig from './data/profile-stats.json'

export type ProfileCategoryId = 'standard' | 'advanced' | 'battedBall' | 'statcast' | 'batTracking'
export type ProfileStatDirection = 'higher' | 'lower' | 'descriptive'
export type ProfileStatFormat = 'rate3' | 'integer' | 'percent' | 'decimal1' | 'decimal2'

export type ProfileCategory = {
  id: ProfileCategoryId
  label: string
  panelLabel: string
  color: string
}

export type ProfileStatDefinition = {
  key: string
  label: string
  category: ProfileCategoryId
  format: ProfileStatFormat
  direction: ProfileStatDirection
  externalSource?: 'sprintSpeed' | 'bsr'
}

export type StatAnalysisScale = {
  increment: number
  label: string
}

type ProfileConfig = {
  categories: ProfileCategory[]
  stats: ProfileStatDefinition[]
}

const profileConfig = rawProfileConfig as ProfileConfig

export const PROFILE_CATEGORIES = profileConfig.categories
export const PROFILE_STAT_DEFINITIONS = profileConfig.stats
export const PROFILE_STAT_BY_KEY = new Map(
  PROFILE_STAT_DEFINITIONS.map((stat) => [stat.key, stat]),
)
export const PROFILE_STAT_INDEX_BY_KEY = new Map(
  PROFILE_STAT_DEFINITIONS.map((stat, index) => [stat.key, index]),
)

export function getStatsForCategory(category: ProfileCategoryId) {
  return PROFILE_STAT_DEFINITIONS.filter((stat) => stat.category === category)
}

const ANALYSIS_SCALE_BY_FORMAT: Record<ProfileStatFormat, StatAnalysisScale> = {
  rate3: { increment: 0.01, label: '+.010' },
  percent: { increment: 0.01, label: '+1 percentage point' },
  integer: { increment: 1, label: '+1 point' },
  decimal1: { increment: 1, label: '+1 unit' },
  decimal2: { increment: 0.1, label: '+0.10' },
}

const ANALYSIS_SCALE_BY_STAT: Readonly<Record<string, StatAnalysisScale>> = {
  EV: { increment: 1, label: '+1 mph' },
  SprintSpeed: { increment: 1, label: '+1 ft/s' },
  BatSpd: { increment: 1, label: '+1 mph' },
  SwgLng: { increment: 1, label: '+1 ft' },
  AtkAng: { increment: 1, label: '+1°' },
  BsR: { increment: 1, label: '+1 BsR run' },
}

export function getStatAnalysisScale(definition: ProfileStatDefinition) {
  return ANALYSIS_SCALE_BY_STAT[definition.key] ?? ANALYSIS_SCALE_BY_FORMAT[definition.format]
}

export function formatProfileStatValue(value: number | null, format: ProfileStatFormat) {
  if (value === null) return '—'

  switch (format) {
    case 'rate3':
      return value.toFixed(3).replace(/^0/, '')
    case 'integer':
      return Math.round(value).toString()
    case 'percent':
      return `${(value * 100).toFixed(1)}%`
    case 'decimal1':
      return value.toFixed(1)
    case 'decimal2':
      return value.toFixed(2)
  }
}

type Rgb = readonly [number, number, number]

function interpolateColor(start: Rgb, end: Rgb, amount: number): Rgb {
  return start.map((channel, index) => Math.round(channel + (end[index] - channel) * amount)) as unknown as Rgb
}

function toCssColor(color: Rgb) {
  return `rgb(${color.join(' ')})`
}

function readableTextColor(color: Rgb) {
  const linear = color.map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })
  const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
  const whiteContrast = 1.05 / (luminance + 0.05)
  const blackContrast = (luminance + 0.05) / 0.05
  return whiteContrast >= blackContrast ? '#fff' : '#111'
}

export function getPercentileStyle(
  percentile: number | null,
  direction: ProfileStatDirection,
): CSSProperties {
  if (percentile === null) return { backgroundColor: '#f2f2f0', color: '#666' }

  const normalized = Math.min(100, Math.max(0, percentile)) / 100
  let color: Rgb

  if (direction === 'descriptive') {
    color = [88, 99, 108]
  } else if (normalized <= 0.5) {
    color = interpolateColor([45, 102, 163], [245, 244, 240], normalized * 2)
  } else {
    color = interpolateColor([245, 244, 240], [193, 62, 65], (normalized - 0.5) * 2)
  }

  return { backgroundColor: toCssColor(color), color: readableTextColor(color) }
}

export function formatPercentile(percentile: number | null) {
  return percentile === null ? '—' : Math.round(percentile).toString()
}

export function formatOrdinalPercentile(percentile: number | null) {
  if (percentile === null) return 'Unavailable'
  const rounded = Math.round(percentile)
  const mod100 = rounded % 100
  const suffix = mod100 >= 11 && mod100 <= 13
    ? 'th'
    : rounded % 10 === 1
      ? 'st'
      : rounded % 10 === 2
        ? 'nd'
        : rounded % 10 === 3
          ? 'rd'
          : 'th'
  return `${rounded}${suffix}`
}
