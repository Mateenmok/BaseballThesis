import { useEffect, type MouseEvent } from 'react'
import { getTeamByAbbreviation } from './data'
import PlayerHeadshot from './PlayerHeadshot'
import ProfileStatSection from './ProfileStatSection'
import { PLAYER_SEASONS } from './playerData'
import { getPlayerProfile } from './playerProfileData'
import {
  BATTED_BALL_STAT_KEYS,
  STANDARD_STAT_KEYS,
  STATCAST_STAT_KEYS,
} from './profileStatGroups'
import TeamStatistics from './TeamStatistics'

type PlayerProfileProps = {
  playerId: number
  season: number
  onNavigateHome: () => void
  onOpenStatistic: (statKey: string, season: number) => void
}

function PlayerProfile({ playerId, season, onNavigateHome, onOpenStatistic }: PlayerProfileProps) {
  const profile = getPlayerProfile(playerId, season)
  const playerSeason = PLAYER_SEASONS.find((player) =>
    player.season === season && player.fangraphsId === playerId)
  const team = profile ? getTeamByAbbreviation(profile.team) : undefined

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
      <div className="profile-dashboard">
        <aside className="profile-sidebar" aria-labelledby="profile-title">
          <a className="profile-back-link" href="/" onClick={handleHomeLink}>
            <span aria-hidden="true">←</span> Back to home
          </a>

          <section className="profile-identity">
            <PlayerHeadshot
              className="player-profile__headshot"
              name={profile.name}
              mlbId={profile.mlbId}
              loading="eager"
            />
            <h1 id="profile-title">{profile.name}</h1>
            <div className="profile-player-meta">
              <span>{profile.season}</span>
              <i aria-hidden="true" />
              <span>{team?.name ?? profile.team}</span>
              {team && <img src={team.logo} alt={`${team.name} logo`} />}
            </div>
            <p className="profile-playing-time">
              <span>{playerSeason?.leadoffGames ?? playerSeason?.games ?? '—'} G</span>
              <i aria-hidden="true" />
              <span>{playerSeason?.plateAppearances ?? '—'} PA</span>
            </p>
          </section>

          <TeamStatistics player={playerSeason} />
        </aside>

        <div className="profile-analysis">
          <header className="profile-analysis__intro">
            <p className="profile-eyebrow">Leadoff split</p>
            <p>Percentiles compare the player&apos;s leadoff split with qualified MLB hitters from the same season.</p>
          </header>

          <ProfileStatSection
            profile={profile}
            statKeys={STANDARD_STAT_KEYS}
            title="Standard"
            columns={2}
            onOpenStatistic={onOpenStatistic}
          />

          <div className="profile-analysis__secondary">
            <ProfileStatSection
              profile={profile}
              statKeys={STATCAST_STAT_KEYS}
              title="Statcast"
              onOpenStatistic={onOpenStatistic}
            />
            <ProfileStatSection
              profile={profile}
              statKeys={BATTED_BALL_STAT_KEYS}
              title="Batted Ball"
              onOpenStatistic={onOpenStatistic}
            />
          </div>
        </div>
      </div>
    </main>
  )
}

export default PlayerProfile
