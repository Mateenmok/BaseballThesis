import type { CSSProperties } from 'react'
import type { PlayerProfileStat } from './playerProfileData'
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
}

function ProfileStatRow({ definition, season, stat }: ProfileStatRowProps) {
  const value = stat?.[0] ?? null
  const percentile = stat?.[2] ?? null
  const displayedValue = formatProfileStatValue(value, definition.format)
  const displayedPercentile = formatPercentile(percentile)
  const ordinalPercentile = formatOrdinalPercentile(percentile)
  const boundedPercentile = percentile === null ? null : Math.min(100, Math.max(0, percentile))
  const isNeutral = definition.direction === 'descriptive'

  return (
    <div className="profile-stat-row" role="row">
      <strong role="cell">{definition.label}</strong>
      <span
        className="profile-percentile-track-cell"
        role="cell"
        aria-label={percentile === null
          ? 'Percentile unavailable'
          : `${ordinalPercentile} percentile among qualified MLB hitters in ${season}`}
      >
        <span
          className={`profile-percentile-track ${isNeutral ? 'profile-percentile-track--neutral' : 'profile-percentile-track--performance'} ${percentile === null ? 'is-missing' : ''}`}
          style={{ '--percentile-position': `${boundedPercentile ?? 0}%` } as CSSProperties}
          aria-hidden="true"
        >
          {boundedPercentile === null ? (
            <span className="profile-percentile-missing">—</span>
          ) : (
            <span
              className="profile-percentile-marker"
              style={{
                ...getPercentileStyle(percentile, definition.direction),
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
    </div>
  )
}

export default ProfileStatRow
