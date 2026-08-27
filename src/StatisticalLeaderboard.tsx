import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { SEASONS, getTeamByAbbreviation } from './data'
import PlayerHeadshot from './PlayerHeadshot'
import { PLAYER_SEASONS, type PlayerSeason } from './playerData'
import { PLAYER_PROFILES } from './playerProfileData'
import { getPlayerProfileHref } from './profileRouting'
import { VISIBLE_PROFILE_STAT_KEYS } from './profileStatGroups'
import {
  PROFILE_STAT_BY_KEY,
  PROFILE_STAT_INDEX_BY_KEY,
  formatProfileStatValue,
  getPercentileStyle,
  type ProfileStatDefinition,
} from './profileStats'
import { STAT_DEFINITIONS } from './statDefinitions'
import StatisticalScatterplot from './StatisticalScatterplot'
import CorrelationRankings, { type CorrelationRanking } from './CorrelationRankings'
import { analyzeRelationship } from './statistics'

type RankingMode = 'top' | 'bottom'
type MinimumGames = 20 | 30 | 40
type LeaderboardView = 'statistic' | 'correlations'

type StatisticalLeaderboardProps = {
  statKey: string
  season: number
  onNavigateHome: () => void
  onOpenPlayer: (player: PlayerSeason) => void
  onOpenStatistic: (statKey: string, season: number) => void
}

type StatisticalLeaderboardEntry = {
  player: PlayerSeason
  profile: (typeof PLAYER_PROFILES)[number]
  value: number
}

const LEADERBOARD_LIMIT = 20

const selectableStats = VISIBLE_PROFILE_STAT_KEYS.flatMap((key) => {
  const definition = PROFILE_STAT_BY_KEY.get(key)
  return definition ? [definition] : []
})

const playerSeasonByIdentity = new Map(
  PLAYER_SEASONS.flatMap((player) => player.fangraphsId === null
    ? []
    : [[`${player.season}|${player.fangraphsId}`, player] as const]),
)

function formatWinningPercentage(value: number | null) {
  return value === null ? '—' : value.toFixed(3).replace(/^0/, '')
}

function formatDelta(value: number | null, digits: number, omitLeadingZero = false) {
  if (value === null) return '—'
  if (Math.abs(value) < 0.5 * 10 ** -digits) return digits === 3 ? '.000' : '0.00'
  const absoluteValue = Math.abs(value).toFixed(digits)
  const formattedValue = omitLeadingZero ? absoluteValue.replace(/^0/, '') : absoluteValue
  return `${value > 0 ? '+' : '−'}${formattedValue}`
}

function findStatistic(query: string) {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return undefined
  return selectableStats.find((stat) =>
    stat.key.toLocaleLowerCase() === normalized || stat.label.toLocaleLowerCase() === normalized)
    ?? selectableStats.find((stat) =>
      stat.label.toLocaleLowerCase().startsWith(normalized) || stat.key.toLocaleLowerCase().startsWith(normalized))
}

function rankingDirection(definition: ProfileStatDefinition, mode: RankingMode) {
  const topAscending = definition.direction === 'lower'
  const ascending = mode === 'top' ? topAscending : !topAscending
  return ascending ? 1 : -1
}

function heatmapStyle(value: number | null, sortedValues: number[]): CSSProperties | undefined {
  if (value === null || sortedValues.length === 0) return undefined
  const below = sortedValues.findIndex((comparison) => comparison >= value)
  const firstMatch = below === -1 ? sortedValues.length : below
  let atOrBelow = firstMatch
  while (atOrBelow < sortedValues.length && sortedValues[atOrBelow] <= value) atOrBelow += 1
  const percentile = ((firstMatch + 0.5 * (atOrBelow - firstMatch)) / sortedValues.length) * 100
  return getPercentileStyle(percentile, 'higher')
}

function StatisticalLeaderboard({
  statKey,
  season,
  onNavigateHome,
  onOpenPlayer,
  onOpenStatistic,
}: StatisticalLeaderboardProps) {
  const definition = PROFILE_STAT_BY_KEY.get(statKey)
  const statIndex = PROFILE_STAT_INDEX_BY_KEY.get(statKey)
  const isSelectableStat = VISIBLE_PROFILE_STAT_KEYS.some((key) => key === statKey)
  const [mode, setMode] = useState<RankingMode>('top')
  const [searchQuery, setSearchQuery] = useState(definition?.label ?? statKey)
  const [minimumGames, setMinimumGames] = useState<MinimumGames>(20)
  const [hideWinningPercentage, setHideWinningPercentage] = useState(false)
  const [activeView, setActiveView] = useState<LeaderboardView>('statistic')

  useEffect(() => {
    setSearchQuery(definition?.label ?? statKey)
    setMode('top')
    document.title = definition
      ? activeView === 'correlations'
        ? `Correlation Rankings — ${season} | Baseball Demo`
        : `${definition.label} Leaders — ${season} | Baseball Demo`
      : 'Statistic not found | Baseball Demo'
    return () => { document.title = 'Baseball Demo' }
  }, [activeView, definition, season, statKey])

  const allEntries = useMemo(() => {
    if (!definition || statIndex === undefined || !isSelectableStat) return []

    return PLAYER_PROFILES.flatMap((profile): StatisticalLeaderboardEntry[] => {
      if (profile.season !== season) return []
      const value = profile.stats[statIndex]?.[0]
      const player = playerSeasonByIdentity.get(`${profile.season}|${profile.playerId}`)
      if (value === null || value === undefined || !player) return []
      const games = player.leadoffGames ?? player.games
      if (games < minimumGames) return []
      return [{ profile, player, value }]
    })
  }, [definition, isSelectableStat, minimumGames, season, statIndex])

  const rankedEntries = useMemo(() => {
    if (!definition) return []
    const direction = rankingDirection(definition, mode)
    return [...allEntries]
      .sort((a, b) =>
        direction * (a.value - b.value) ||
        b.player.plateAppearances - a.player.plateAppearances ||
        a.player.name.localeCompare(b.player.name))
      .slice(0, LEADERBOARD_LIMIT)
  }, [allEntries, definition, mode])

  const correlationRankings = useMemo(() => selectableStats.map((stat): CorrelationRanking => {
    const index = PROFILE_STAT_INDEX_BY_KEY.get(stat.key)
    if (index === undefined) return { definition: stat, pearson: null, spearman: null, n: 0 }

    const observations = PLAYER_PROFILES.flatMap((profile) => {
      if (profile.season !== season) return []
      const value = profile.stats[index]?.[0]
      const player = playerSeasonByIdentity.get(`${profile.season}|${profile.playerId}`)
      if (value === null || value === undefined || !player || player.runsPerGameDelta === null) return []
      const games = player.leadoffGames ?? player.games
      if (games < minimumGames) return []
      return [{ x: value, y: player.runsPerGameDelta, weight: games }]
    })
    const analysis = analyzeRelationship(observations)
    return {
      definition: stat,
      pearson: analysis.pearson,
      spearman: analysis.spearman,
      n: analysis.n,
    }
  }).sort((a, b) => {
    if (a.pearson === null) return b.pearson === null ? a.definition.label.localeCompare(b.definition.label) : 1
    if (b.pearson === null) return -1
    return Math.abs(b.pearson) - Math.abs(a.pearson) || a.definition.label.localeCompare(b.definition.label)
  }), [minimumGames, season])

  const teamHeatmapValues = useMemo(() => ({
    runsPerGame: allEntries
      .flatMap(({ player }) => player.teamRunsPerGame === null ? [] : [player.teamRunsPerGame])
      .sort((a, b) => a - b),
    winPercentage: allEntries
      .flatMap(({ player }) => player.teamWinPercentage === null ? [] : [player.teamWinPercentage])
      .sort((a, b) => a - b),
    runsDelta: allEntries
      .flatMap(({ player }) => player.runsPerGameDelta === null ? [] : [player.runsPerGameDelta])
      .sort((a, b) => a - b),
    winDelta: allEntries
      .flatMap(({ player }) => player.winPercentageDelta === null ? [] : [player.winPercentageDelta])
      .sort((a, b) => a - b),
  }), [allEntries])

  function handleHomeLink(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onNavigateHome()
  }

  function handlePlayerLink(event: MouseEvent<HTMLAnchorElement>, player: PlayerSeason) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onOpenPlayer(player)
  }

  function openSearchResult(query: string) {
    const result = findStatistic(query)
    if (!result) return
    setActiveView('statistic')
    if (result.key !== statKey) onOpenStatistic(result.key, season)
  }

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    const nextQuery = event.target.value
    setSearchQuery(nextQuery)
    const exactMatch = selectableStats.find((stat) =>
      stat.label.toLocaleLowerCase() === nextQuery.trim().toLocaleLowerCase())
    if (exactMatch) {
      setActiveView('statistic')
      if (exactMatch.key !== statKey) onOpenStatistic(exactMatch.key, season)
    }
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    openSearchResult(searchQuery)
  }

  if (!definition || statIndex === undefined || !isSelectableStat) {
    return (
      <main className="stat-leaderboard-page stat-leaderboard-page--not-found">
        <p className="profile-eyebrow">Statistical leaderboards</p>
        <h1>Statistic not found</h1>
        <p>The requested statistic is not available in the player-profile dataset.</p>
        <a href="/" onClick={handleHomeLink}>Back to home</a>
      </main>
    )
  }

  const definitionText = STAT_DEFINITIONS[statKey] ?? `${definition.label} for the selected leadoff split.`

  return (
    <main className="stat-leaderboard-page">
      <a className="stat-leaderboard-back" href="/" onClick={handleHomeLink}>
        <span aria-hidden="true">←</span> Back to home
      </a>

      <header className="stat-leaderboard-hero">
        <p className="profile-eyebrow">{season} leadoff splits</p>
        <h1>Statistical Leaderboards</h1>
        <div className="stat-leaderboard-controls">
          <div className="stat-search">
            <label htmlFor="statistic-search">Search a statistic</label>
            <input
              id="statistic-search"
              type="search"
              list="statistic-options"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search a statistic"
              autoComplete="off"
            />
            <datalist id="statistic-options">
              {selectableStats.map((stat) => <option key={stat.key} value={stat.label} />)}
            </datalist>
          </div>
          <div className="stat-season-field">
            <label htmlFor="stat-leaderboard-season">Season</label>
            <div className="select-wrap">
              <select
                id="stat-leaderboard-season"
                value={season}
                onChange={(event) => onOpenStatistic(statKey, Number(event.target.value))}
              >
                {SEASONS.map((availableSeason) => (
                  <option key={availableSeason} value={availableSeason}>{availableSeason}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      <nav className="stat-view-tabs" aria-label="Statistical leaderboard views">
        <button
          type="button"
          className={activeView === 'statistic' ? 'is-selected' : ''}
          aria-current={activeView === 'statistic' ? 'page' : undefined}
          onClick={() => setActiveView('statistic')}
        >
          Individual Statistic
        </button>
        <button
          type="button"
          className={activeView === 'correlations' ? 'is-selected' : ''}
          aria-current={activeView === 'correlations' ? 'page' : undefined}
          onClick={() => setActiveView('correlations')}
        >
          Correlation Rankings
        </button>
      </nav>

      {activeView === 'statistic' ? <>
      <section className="stat-leaderboard-overview" aria-labelledby="selected-stat-title">
        <div>
          <p className="profile-eyebrow">Selected statistic</p>
          <h2 id="selected-stat-title">{definition.label}</h2>
        </div>
        <div className="stat-definition">
          <p className="profile-eyebrow">Definition</p>
          <p>{definitionText}</p>
        </div>
      </section>

      <section className="stat-ranking" aria-label={`${definition.label} rankings for ${season}`}>
        <header className="stat-ranking__toolbar">
          <div className="stat-ranking__filters">
            <div className="stat-filter-group">
              <span>Rankings</span>
              <div className="metric-switch" aria-label="Ranking direction">
                <button
                  type="button"
                  className={mode === 'top' ? 'is-selected' : ''}
                  aria-pressed={mode === 'top'}
                  onClick={() => setMode('top')}
                >
                  Top 20
                </button>
                <button
                  type="button"
                  className={mode === 'bottom' ? 'is-selected' : ''}
                  aria-pressed={mode === 'bottom'}
                  onClick={() => setMode('bottom')}
                >
                  Bottom 20
                </button>
              </div>
            </div>

            <div className="stat-filter-group">
              <span>Minimum games</span>
              <div className="metric-switch" aria-label="Minimum games played">
                {([20, 30, 40] as const).map((games) => (
                  <button
                    type="button"
                    key={games}
                    className={minimumGames === games ? 'is-selected' : ''}
                    aria-pressed={minimumGames === games}
                    onClick={() => setMinimumGames(games)}
                  >
                    {games}
                  </button>
                ))}
              </div>
            </div>

            <div className="stat-filter-group">
              <span>Team columns</span>
              <button
                type="button"
                className={`stat-boolean-toggle ${hideWinningPercentage ? 'is-selected' : ''}`}
                aria-pressed={hideWinningPercentage}
                onClick={() => setHideWinningPercentage((isHidden) => !isHidden)}
              >
                <i aria-hidden="true" />
                Hide Win%
              </button>
            </div>
          </div>
          <p>{allEntries.length} players with at least {minimumGames} G and reported {definition.label}</p>
        </header>

        <StatisticalScatterplot
          entries={allEntries}
          definition={definition}
          season={season}
          onOpenPlayer={onOpenPlayer}
        />

        <div className="stat-ranking__table-wrap">
          <table className={`stat-ranking__table ${hideWinningPercentage ? 'is-win-hidden' : ''}`}>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Player</th>
                <th scope="col">Team</th>
                <th scope="col">{definition.label}</th>
                <th scope="col">G</th>
                <th scope="col">PA</th>
                <th scope="col">Team R/G</th>
                <th scope="col">R/G vs. Avg</th>
                {!hideWinningPercentage && <th scope="col">Team Win%</th>}
                {!hideWinningPercentage && <th scope="col">Win% vs. Avg</th>}
              </tr>
            </thead>
            <tbody>
              {rankedEntries.map(({ profile, player, value }, index) => {
                const team = getTeamByAbbreviation(player.team)
                return (
                  <tr key={`${profile.season}-${profile.playerId}`}>
                    <td>{index + 1}</td>
                    <th scope="row">
                      <a
                        className="stat-player-link"
                        href={getPlayerProfileHref(profile.playerId, profile.season)}
                        onClick={(event) => handlePlayerLink(event, player)}
                      >
                        <PlayerHeadshot name={profile.name} mlbId={profile.mlbId} />
                        <span>{profile.name}</span>
                      </a>
                    </th>
                    <td>
                      <span className="stat-team-cell">
                        {team && <img src={team.logo} alt="" aria-hidden="true" />}
                        <span>{player.team}</span>
                      </span>
                    </td>
                    <td className="stat-ranking__primary-value">
                      {formatProfileStatValue(value, definition.format)}
                    </td>
                    <td>{player.leadoffGames ?? player.games}</td>
                    <td>{player.plateAppearances}</td>
                    <td
                      className="stat-team-heat"
                      style={heatmapStyle(player.teamRunsPerGame, teamHeatmapValues.runsPerGame)}
                    >
                      {player.teamRunsPerGame?.toFixed(2) ?? '—'}
                    </td>
                    <td
                      className="stat-team-heat"
                      style={heatmapStyle(player.runsPerGameDelta, teamHeatmapValues.runsDelta)}
                    >
                      {formatDelta(player.runsPerGameDelta, 2)}
                    </td>
                    {!hideWinningPercentage && (
                      <td
                        className="stat-team-heat"
                        style={heatmapStyle(player.teamWinPercentage, teamHeatmapValues.winPercentage)}
                      >
                        {formatWinningPercentage(player.teamWinPercentage)}
                      </td>
                    )}
                    {!hideWinningPercentage && (
                      <td
                        className="stat-team-heat"
                        style={heatmapStyle(player.winPercentageDelta, teamHeatmapValues.winDelta)}
                      >
                        {formatDelta(player.winPercentageDelta, 3, true)}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      </> : (
        <CorrelationRankings
          rows={correlationRankings}
          season={season}
          minimumGames={minimumGames}
          onMinimumGamesChange={setMinimumGames}
          onOpenStatistic={(nextStatKey, nextSeason) => {
            setActiveView('statistic')
            onOpenStatistic(nextStatKey, nextSeason)
          }}
        />
      )}
    </main>
  )
}

export default StatisticalLeaderboard
