import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import PlayerHeadshot from './PlayerHeadshot'
import ProfileStatRow from './ProfileStatRow'
import { getPlayerProfile } from './playerProfileData'
import {
  PROFILE_CATEGORIES,
  PROFILE_STAT_INDEX_BY_KEY,
  getStatsForCategory,
  type ProfileCategoryId,
} from './profileStats'

type PlayerProfileProps = {
  playerId: number
  season: number
  onNavigateHome: () => void
}

function PlayerProfile({ playerId, season, onNavigateHome }: PlayerProfileProps) {
  const profile = getPlayerProfile(playerId, season)
  const [category, setCategory] = useState<ProfileCategoryId>('standard')
  const selectedCategory = PROFILE_CATEGORIES.find(({ id }) => id === category) ?? PROFILE_CATEGORIES[0]
  const selectedStats = useMemo(() => getStatsForCategory(category), [category])

  useEffect(() => {
    document.title = profile ? `${profile.name} — ${profile.season} | Baseball Demo` : 'Player not found | Baseball Demo'
    return () => { document.title = 'Baseball Demo' }
  }, [profile])

  function handleHomeLink(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onNavigateHome()
  }

  if (!profile) {
    return (
      <main className="profile-page profile-page--not-found">
        <p className="profile-eyebrow">Player profile</p>
        <h1>Player not found</h1>
        <p>This player-season is not available in the canonical leadoff dataset.</p>
        <a href="/" onClick={handleHomeLink}>Back to analysis</a>
      </main>
    )
  }

  return (
    <main className="profile-page">
      <a className="profile-back-link" href="/" onClick={handleHomeLink}>
        <span aria-hidden="true">←</span> Back to analysis
      </a>

      <div className="profile-layout">
        <section className="profile-identity" aria-labelledby="profile-title">
          <p className="profile-eyebrow">Player profile</p>
          <h1 id="profile-title">{profile.name} <span>— {profile.season}</span></h1>
          <p className="profile-team">{profile.team}</p>

          <PlayerHeadshot
            className="player-profile__headshot"
            name={profile.name}
            mlbId={profile.mlbId}
            loading="eager"
          />

          <nav className="profile-categories" aria-label="Statistic category">
            {PROFILE_CATEGORIES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === category ? 'is-selected' : ''}
                style={{ '--category-color': item.color } as React.CSSProperties}
                aria-pressed={item.id === category}
                onClick={() => setCategory(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </section>

        <section className="profile-stat-panel" aria-labelledby="profile-stat-heading">
          <header>
            <p className="profile-eyebrow">Leadoff split</p>
            <h2 id="profile-stat-heading">{selectedCategory.panelLabel}</h2>
            <p>
              Percentiles compare the player&apos;s leadoff split with qualified MLB hitters from the same season.
            </p>
          </header>

          <div className="profile-stat-table" role="table" aria-label={`${selectedCategory.panelLabel} for ${profile.name}`}>
            <div className="profile-stat-row profile-stat-row--header" role="row">
              <span role="columnheader">Stat</span>
              <span role="columnheader">MLB Percentile</span>
              <span role="columnheader">Value</span>
            </div>
            {selectedStats.map((definition) => {
              const statIndex = PROFILE_STAT_INDEX_BY_KEY.get(definition.key)
              const stat = statIndex === undefined ? undefined : profile.stats[statIndex]
              return (
                <ProfileStatRow
                  key={definition.key}
                  definition={definition}
                  season={profile.season}
                  stat={stat}
                />
              )
            })}
          </div>
        </section>
      </div>
    </main>
  )
}

export default PlayerProfile
