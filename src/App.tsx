import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { MLB_TEAMS, SEASONS, type Season, type TeamName } from './data'
import PlayerList from './PlayerList'
import { PLAYER_SEASONS, type PlayerSeason } from './playerData'
import { getPlayerProfileHref, readAppRoute } from './profileRouting'
import TeamSelector from './TeamSelector'

const LeagueLeaders = lazy(() => import('./LeagueLeaders'))
const PlayerProfile = lazy(() => import('./PlayerProfile'))

function App() {
  const [route, setRoute] = useState(readAppRoute)
  const [analysisMode, setAnalysisMode] = useState<'team' | 'league'>('team')
  const [selectedTeam, setSelectedTeam] = useState<TeamName | ''>('')
  const [selectedSeason, setSelectedSeason] = useState<Season>(2026)
  const selectedTeamData = MLB_TEAMS.find((team) => team.name === selectedTeam)
  const players = useMemo(() => {
    if (!selectedTeamData) return []
    const teamCodes = [selectedTeamData.abbreviation, ...(selectedTeamData.legacyAbbreviations ?? [])]

    return PLAYER_SEASONS
      .filter((player) => teamCodes.includes(player.team) && player.season === selectedSeason)
      .sort((a, b) => b.plateAppearances - a.plateAppearances || a.name.localeCompare(b.name))
  }, [selectedSeason, selectedTeamData])

  useEffect(() => {
    const handlePopState = () => setRoute(readAppRoute())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const openPlayerProfile = useCallback((player: PlayerSeason) => {
    if (player.fangraphsId === null) return
    const href = getPlayerProfileHref(player.fangraphsId, player.season)
    window.history.pushState(null, '', href)
    setRoute({ kind: 'profile', playerId: player.fangraphsId, season: player.season })
    window.scrollTo(0, 0)
  }, [])

  const navigateHome = useCallback(() => {
    window.history.pushState(null, '', '/')
    setRoute({ kind: 'analysis' })
    window.scrollTo(0, 0)
  }, [])

  if (route.kind === 'profile') {
    return (
      <Suspense fallback={<p className="profile-loading">Loading player profile…</p>}>
        <PlayerProfile
          playerId={route.playerId}
          season={route.season}
          onNavigateHome={navigateHome}
        />
      </Suspense>
    )
  }

  return (
    <main className="page-shell">
      <h1>Baseball Demo</h1>

      <nav className="analysis-switch" aria-label="Analysis mode">
        <button
          type="button"
          className={analysisMode === 'team' ? 'is-selected' : ''}
          aria-current={analysisMode === 'team' ? 'page' : undefined}
          onClick={() => setAnalysisMode('team')}
        >
          Team Explorer
        </button>
        <button
          type="button"
          className={analysisMode === 'league' ? 'is-selected' : ''}
          aria-current={analysisMode === 'league' ? 'page' : undefined}
          onClick={() => setAnalysisMode('league')}
        >
          League Leaders
        </button>
      </nav>

      {analysisMode === 'team' ? (
        <>
          <div className="selector-grid">
            <div className="field">
              <label id="team-label" htmlFor="team">Team Name</label>
              <TeamSelector value={selectedTeam} onChange={setSelectedTeam} />
            </div>

            <div className="field">
              <label htmlFor="season">Season</label>
              <div className="select-wrap">
                <select
                  id="season"
                  value={selectedSeason}
                  onChange={(event) => setSelectedSeason(Number(event.target.value) as Season)}
                >
                  {SEASONS.map((season) => (
                    <option key={season} value={season}>
                      {season}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {selectedTeamData && (
            <section className="player-results" aria-live="polite" aria-label="Players">
              <PlayerList players={players} onOpenPlayer={openPlayerProfile} />
            </section>
          )}
        </>
      ) : (
        <Suspense fallback={<p className="analysis-loading">Loading league leaders…</p>}>
          <LeagueLeaders
            season={selectedSeason}
            onSeasonChange={setSelectedSeason}
            onOpenPlayer={openPlayerProfile}
          />
        </Suspense>
      )}
    </main>
  )
}

export default App
