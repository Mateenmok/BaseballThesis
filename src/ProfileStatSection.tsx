import ProfileStatRow from './ProfileStatRow'
import type { PlayerProfileData } from './playerProfileData'
import {
  PROFILE_STAT_BY_KEY,
  PROFILE_STAT_INDEX_BY_KEY,
} from './profileStats'

type ProfileStatSectionProps = {
  profile: PlayerProfileData
  statKeys: readonly string[]
  title: string
  columns?: 1 | 2
  onOpenStatistic: (statKey: string, season: number) => void
}

function ProfileStatSection({ profile, statKeys, title, columns = 1, onOpenStatistic }: ProfileStatSectionProps) {
  const columnSize = Math.ceil(statKeys.length / columns)
  const statColumns = Array.from({ length: columns }, (_, index) =>
    statKeys.slice(index * columnSize, (index + 1) * columnSize))

  return (
    <section className={`profile-stat-section profile-stat-section--${columns}-column`} aria-labelledby={`${title.replaceAll(' ', '-').toLowerCase()}-heading`}>
      <h2 id={`${title.replaceAll(' ', '-').toLowerCase()}-heading`}>{title}</h2>
      <div className="profile-stat-section__columns">
        {statColumns.map((keys, columnIndex) => (
          <div
            className="profile-stat-table"
            role="table"
            aria-label={`${title} stats for ${profile.name}${columns > 1 ? `, column ${columnIndex + 1}` : ''}`}
            key={`${title}-${columnIndex}`}
          >
            <div className="profile-stat-row profile-stat-row--header" role="row">
              <span role="columnheader">Stat</span>
              <span role="columnheader">Performance Percentile</span>
              <span role="columnheader">Value</span>
            </div>
            {keys.map((key) => {
              const definition = PROFILE_STAT_BY_KEY.get(key)
              const statIndex = PROFILE_STAT_INDEX_BY_KEY.get(key)
              if (!definition || statIndex === undefined) return null
              return (
                <ProfileStatRow
                  key={key}
                  definition={definition}
                  season={profile.season}
                  stat={profile.stats[statIndex]}
                  onOpenStatistic={onOpenStatistic}
                />
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}

export default ProfileStatSection
