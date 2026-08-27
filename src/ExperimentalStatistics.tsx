import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from 'react'
import { SEASONS, getTeamByAbbreviation } from './data'
import {
  EXPERIMENTAL_METRICS,
  EXPERIMENTAL_METRIC_BY_ID,
  getExperimentalComponentLabel,
  getExperimentalMetricAnalysis,
  type ExperimentalMetric,
} from './experimentalMetrics'
import PlayerHeadshot from './PlayerHeadshot'
import type { PlayerSeason } from './playerData'
import { getPlayerProfileHref } from './profileRouting'
import { getPercentileStyle, type ProfileStatDefinition } from './profileStats'
import StatisticalScatterplot from './StatisticalScatterplot'

type MinimumGames = 20 | 30 | 40

type ExperimentalStatisticsProps = {
  season: number
  metricId?: string
  onNavigateHome: () => void
  onOpenMetric: (season: number, metricId?: string) => void
  onOpenPlayer: (player: PlayerSeason) => void
}

const EXPERIMENTAL_SCORE_DEFINITION: ProfileStatDefinition = {
  key: 'ExperimentalScore',
  label: 'Experimental Score',
  category: 'advanced',
  format: 'decimal1',
  direction: 'higher',
}

const COMPARISON_SEASONS = [2023, 2024, 2025, 2026] as const

function formatCorrelation(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—'
  const absolute = Math.abs(value).toFixed(2).replace(/^0/, '')
  if (Math.abs(value) < 0.005) return absolute
  return `${value > 0 ? '+' : '−'}${absolute}`
}

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

function heatmapStyle(value: number | null, sortedValues: number[]): CSSProperties | undefined {
  if (value === null || sortedValues.length === 0) return undefined
  const firstGreaterOrEqual = sortedValues.findIndex((comparison) => comparison >= value)
  const firstMatch = firstGreaterOrEqual === -1 ? sortedValues.length : firstGreaterOrEqual
  let atOrBelow = firstMatch
  while (atOrBelow < sortedValues.length && sortedValues[atOrBelow] <= value) atOrBelow += 1
  const percentile = ((firstMatch + 0.5 * (atOrBelow - firstMatch)) / sortedValues.length) * 100
  return getPercentileStyle(percentile, 'higher')
}

function componentList(metric: ExperimentalMetric) {
  return metric.components.map(getExperimentalComponentLabel).join(' + ')
}

function formulaText(metric: ExperimentalMetric) {
  return `(${metric.components.map((component) => `${getExperimentalComponentLabel(component)} ${component.percentileMode} percentile`).join(' + ')}) ÷ ${metric.components.length}`
}

function directionConsistency(values: Array<number | null>) {
  const available = values.filter((value): value is number => value !== null)
  if (available.length === 0) return '—'
  const positive = available.filter((value) => value > 0).length
  const negative = available.filter((value) => value < 0).length
  const neutral = available.length - positive - negative
  if (positive >= negative && positive >= neutral) return `${positive} / ${available.length} positive`
  if (negative >= neutral) return `${negative} / ${available.length} negative`
  return `${neutral} / ${available.length} neutral`
}

function ExperimentalStatistics({
  season,
  metricId,
  onNavigateHome,
  onOpenMetric,
  onOpenPlayer,
}: ExperimentalStatisticsProps) {
  const [minimumGames, setMinimumGames] = useState<MinimumGames>(20)
  const metric = metricId ? EXPERIMENTAL_METRIC_BY_ID.get(metricId) : undefined

  useEffect(() => {
    document.title = metric
      ? `${metric.name} — ${season} | Baseball Demo`
      : `Experimental Statistics — ${season} | Baseball Demo`
    return () => { document.title = 'Baseball Demo' }
  }, [metric, season])

  useEffect(() => {
    if (metricId && !metric) onOpenMetric(season)
  }, [metric, metricId, onOpenMetric, season])

  const selectedSeasonAnalyses = useMemo(() => new Map(
    EXPERIMENTAL_METRICS.map((experimentalMetric) => [
      experimentalMetric.id,
      getExperimentalMetricAnalysis(experimentalMetric, season, minimumGames),
    ]),
  ), [minimumGames, season])

  const crossSeasonAnalyses = useMemo(() => new Map(
    EXPERIMENTAL_METRICS.map((experimentalMetric) => [
      experimentalMetric.id,
      new Map(SEASONS.map((availableSeason) => [
        availableSeason,
        getExperimentalMetricAnalysis(experimentalMetric, availableSeason, minimumGames),
      ])),
    ]),
  ), [minimumGames])

  function handleHomeLink(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onNavigateHome()
  }

  function handleOverviewLink(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onOpenMetric(season)
  }

  function handleMetricLink(event: MouseEvent<HTMLAnchorElement>, nextMetric: ExperimentalMetric) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onOpenMetric(season, nextMetric.id)
  }

  function handlePlayerLink(event: MouseEvent<HTMLAnchorElement>, player: PlayerSeason) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onOpenPlayer(player)
  }

  if (metricId && !metric) {
    return (
      <main className="experimental-page experimental-page--not-found">
        <p className="profile-eyebrow">Experimental Statistics</p>
        <h1>Archetype not found</h1>
        <p>This retired experimental archetype is returning to the current overview.</p>
        <a href={`/experimental/${season}`} onClick={handleOverviewLink}>Back to Experimental Statistics</a>
      </main>
    )
  }

  const currentAnalysis = metric ? selectedSeasonAnalyses.get(metric.id) : undefined
  const rankedEntries = currentAnalysis
    ? [...currentAnalysis.entries].sort((a, b) =>
      b.value - a.value ||
      b.player.plateAppearances - a.player.plateAppearances ||
      a.profile.name.localeCompare(b.profile.name))
    : []
  const teamHeatmapValues = {
    runsPerGame: rankedEntries.flatMap(({ player }) => player.teamRunsPerGame === null ? [] : [player.teamRunsPerGame]).sort((a, b) => a - b),
    runsDelta: rankedEntries.flatMap(({ player }) => player.runsPerGameDelta === null ? [] : [player.runsPerGameDelta]).sort((a, b) => a - b),
    winPercentage: rankedEntries.flatMap(({ player }) => player.teamWinPercentage === null ? [] : [player.teamWinPercentage]).sort((a, b) => a - b),
    winDelta: rankedEntries.flatMap(({ player }) => player.winPercentageDelta === null ? [] : [player.winPercentageDelta]).sort((a, b) => a - b),
  }

  return (
    <main className="experimental-page">
      <a className="stat-leaderboard-back" href="/" onClick={handleHomeLink}>
        <span aria-hidden="true">←</span> Back to home
      </a>

      <header className="experimental-hero">
        <p className="profile-eyebrow">{season} leadoff splits · exploratory analysis</p>
        <h1>Experimental Statistics</h1>
        <p>
          Experimental Scores combine same-season MLB performance percentiles using predefined equal weights.
          Relationships with team scoring are exploratory associations and do not establish that player traits caused changes in run production.
        </p>
        <div className="experimental-global-controls">
          <div className="stat-season-field">
            <label htmlFor="experimental-season">Season</label>
            <div className="select-wrap">
              <select
                id="experimental-season"
                value={season}
                onChange={(event) => onOpenMetric(Number(event.target.value), metric?.id)}
              >
                {SEASONS.map((availableSeason) => (
                  <option key={availableSeason} value={availableSeason}>{availableSeason}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="stat-filter-group">
            <span>Minimum games</span>
            <div className="metric-switch" role="group" aria-label="Minimum games played">
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
        </div>
      </header>

      {!metric ? (
        <>
          <section className="experimental-overview" aria-labelledby="experimental-overview-title">
            <div className="experimental-section-heading">
              <p className="profile-eyebrow">Predefined hypotheses</p>
              <h2 id="experimental-overview-title">Four interpretable archetypes</h2>
              <p>Each score is an equal-weight average of all required component percentiles. Players missing any component are excluded rather than assigned a partial score.</p>
            </div>
            <div className="experimental-card-grid">
              {EXPERIMENTAL_METRICS.map((experimentalMetric) => {
                const result = selectedSeasonAnalyses.get(experimentalMetric.id)
                return (
                  <article className="experimental-card" key={experimentalMetric.id}>
                    <p className="profile-eyebrow">Experimental archetype</p>
                    <h3>{experimentalMetric.name}</h3>
                    <strong>{componentList(experimentalMetric)}</strong>
                    <p>{experimentalMetric.description}</p>
                    <dl>
                      <div><dt>Pearson r</dt><dd>{formatCorrelation(result?.analysis.pearson ?? null)}</dd></div>
                      <div><dt>Spearman ρ</dt><dd>{formatCorrelation(result?.analysis.spearman ?? null)}</dd></div>
                      <div><dt>n</dt><dd>{result?.analysis.n ?? 0}</dd></div>
                    </dl>
                    <a
                      href={`/experimental/${season}/${encodeURIComponent(experimentalMetric.id)}`}
                      onClick={(event) => handleMetricLink(event, experimentalMetric)}
                    >
                      Explore <span aria-hidden="true">→</span>
                    </a>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="experimental-comparison" aria-labelledby="cross-season-title">
            <div className="experimental-section-heading">
              <p className="profile-eyebrow">Cross-season consistency</p>
              <h2 id="cross-season-title">Pearson r by season</h2>
              <p>Each season is calculated independently with that season&apos;s qualified MLB reference population. Missing results are omitted from the mean, never treated as zero.</p>
            </div>
            <div className="experimental-table-wrap">
              <table className="experimental-comparison-table">
                <thead>
                  <tr>
                    <th scope="col">Archetype</th>
                    {COMPARISON_SEASONS.map((availableSeason) => <th scope="col" key={availableSeason}>{availableSeason}</th>)}
                    <th scope="col">Mean r</th>
                    <th scope="col">Direction consistency</th>
                  </tr>
                </thead>
                <tbody>
                  {EXPERIMENTAL_METRICS.map((experimentalMetric) => {
                    const bySeason = crossSeasonAnalyses.get(experimentalMetric.id)
                    const values = COMPARISON_SEASONS.map((availableSeason) => bySeason?.get(availableSeason)?.analysis.pearson ?? null)
                    const availableValues = values.filter((value): value is number => value !== null)
                    const mean = availableValues.length
                      ? availableValues.reduce((sum, value) => sum + value, 0) / availableValues.length
                      : null
                    return (
                      <tr key={experimentalMetric.id}>
                        <th scope="row">
                          <a
                            href={`/experimental/${season}/${encodeURIComponent(experimentalMetric.id)}`}
                            onClick={(event) => handleMetricLink(event, experimentalMetric)}
                          >
                            {experimentalMetric.name}
                          </a>
                        </th>
                        {values.map((value, index) => <td key={index}>{formatCorrelation(value)}</td>)}
                        <td className="experimental-comparison-table__mean">{formatCorrelation(mean)}</td>
                        <td>{directionConsistency(values)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="experimental-detail-heading" aria-labelledby="experimental-detail-title">
            <div>
              <a href={`/experimental/${season}`} onClick={handleOverviewLink}>
                <span aria-hidden="true">←</span> All archetypes
              </a>
              <p className="profile-eyebrow">Experimental archetype</p>
              <h2 id="experimental-detail-title">{metric.name}</h2>
              <p className="experimental-detail-heading__components">{componentList(metric)}</p>
            </div>
            <div className="experimental-definition">
              <div><span>Definition</span><p>{metric.description}. A 0–100 score where a higher value indicates a stronger fit for this predefined archetype.</p></div>
              <div><span>Formula</span><p>{formulaText(metric)}</p></div>
              <div><span>Hypothesis</span><p>{metric.hypothesis}</p></div>
              {metric.components.flatMap((component) => component.assumption ? [
                <div key={component.statKey}><span>Modeling assumption</span><p>{component.assumption}</p></div>,
              ] : [])}
            </div>
          </section>

          <section className="experimental-detail-analysis" aria-label={`${metric.name} analysis for ${season}`}>
            <header className="experimental-sample-summary">
              <p>{rankedEntries.length} players have complete component data and at least {minimumGames} leadoff G. Statistical sample n = {currentAnalysis?.analysis.n ?? 0}.</p>
            </header>
            <StatisticalScatterplot
              entries={rankedEntries}
              definition={{ ...EXPERIMENTAL_SCORE_DEFINITION, key: `ExperimentalScore:${metric.id}`, label: `${metric.name} Score` }}
              season={season}
              onOpenPlayer={onOpenPlayer}
              analysisScale={{ increment: 10, label: '+10 score points' }}
              allowWinOutcome={false}
            />

            <div className="experimental-leaderboard-heading">
              <p className="profile-eyebrow">Experimental score leaderboard</p>
              <h3>{metric.name} — {season}</h3>
            </div>
            <div className="stat-ranking__table-wrap experimental-table-wrap">
              <table className="stat-ranking__table experimental-leaderboard-table">
                <thead>
                  <tr>
                    <th scope="col">Rank</th>
                    <th scope="col">Player</th>
                    <th scope="col">Team</th>
                    <th scope="col">Score</th>
                    <th scope="col">G</th>
                    <th scope="col">PA</th>
                    <th scope="col">Team R/G</th>
                    <th scope="col">R/G vs. Avg</th>
                    <th scope="col">Team Win%</th>
                    <th scope="col">Win% vs. Avg</th>
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
                        <td className="stat-ranking__primary-value">{value.toFixed(1)}</td>
                        <td>{player.leadoffGames ?? player.games}</td>
                        <td>{player.plateAppearances}</td>
                        <td className="stat-team-heat" style={heatmapStyle(player.teamRunsPerGame, teamHeatmapValues.runsPerGame)}>{player.teamRunsPerGame?.toFixed(2) ?? '—'}</td>
                        <td className="stat-team-heat" style={heatmapStyle(player.runsPerGameDelta, teamHeatmapValues.runsDelta)}>{formatDelta(player.runsPerGameDelta, 2)}</td>
                        <td className="stat-team-heat" style={heatmapStyle(player.teamWinPercentage, teamHeatmapValues.winPercentage)}>{formatWinningPercentage(player.teamWinPercentage)}</td>
                        <td className="stat-team-heat" style={heatmapStyle(player.winPercentageDelta, teamHeatmapValues.winDelta)}>{formatDelta(player.winPercentageDelta, 3, true)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  )
}

export default ExperimentalStatistics
