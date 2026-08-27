import type { CSSProperties, MouseEvent } from 'react'
import type { PlayerProfileStat } from './playerProfileData'
import { getStatisticLeaderboardHref } from './profileRouting'
import {
  formatOrdinalPercentile,
  formatPercentile,
  formatProfileStatValue,
  getPercentileStyle,
  type ProfileStatDefinition,
} from './profileStats'

type ProfileStatRowProps = {
  definition: ProfileStatDefinition
  season: number
  stat?: PlayerProfileStat
  onOpenStatistic: (statKey: string, season: number) => void
}

function ProfileStatRow({ definition, season, stat, onOpenStatistic }: ProfileStatRowProps) {
  const value = stat?.[0] ?? null
  const percentile = stat?.[2] ?? null
  const displayedValue = formatProfileStatValue(value, definition.format)
  const displayedPercentile = formatPercentile(percentile)
  const ordinalPercentile = formatOrdinalPercentile(percentile)
  const boundedPercentile = percentile === null ? null : Math.min(100, Math.max(0, percentile))
  const isNeutral = definition.direction === 'descriptive'
  const markerStyle = getPercentileStyle(percentile, definition.direction)
  const trackStyle = {
    '--percentile-position': `${boundedPercentile ?? 0}%`,
    '--percentile-fill-color': markerStyle.backgroundColor,
  } as CSSProperties

  function handleStatisticLink(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onOpenStatistic(definition.key, season)
  }

  return (
    <a
      className="profile-stat-row profile-stat-row--link"
      role="row"
      href={getStatisticLeaderboardHref(definition.key, season)}
      onClick={handleStatisticLink}
      aria-label={`Open ${definition.label} leaderboard for ${season}`}
    >
      <strong role="cell">{definition.label}</strong>
      <span
        className="profile-percentile-track-cell"
        role="cell"
        aria-label={percentile === null
          ? 'Percentile unavailable'
          : `${ordinalPercentile} performance percentile among qualified MLB hitters in ${season}${definition.direction === 'lower' ? '; lower values are better' : ''}`}
      >
        <span
          className={`profile-percentile-track ${isNeutral ? 'profile-percentile-track--neutral' : 'profile-percentile-track--performance'} ${percentile === null ? 'is-missing' : ''}`}
          style={trackStyle}
          aria-hidden="true"
        >
          {boundedPercentile === null ? (
            <span className="profile-percentile-missing">—</span>
          ) : (
            <span
              className={`profile-percentile-marker ${!isNeutral && boundedPercentile >= 40 && boundedPercentile <= 60 ? 'is-midrange' : ''}`}
              style={{
                ...markerStyle,
                left: `clamp(19px, ${boundedPercentile}%, calc(100% - 19px))`,
              }}
            >
              {displayedPercentile}
            </span>
          )}
        </span>
      </span>
      <span className="profile-stat-value" role="cell" aria-label={`Value ${displayedValue}`}>
        {displayedValue}
      </span>
    </a>
  )
}

export default ProfileStatRow
