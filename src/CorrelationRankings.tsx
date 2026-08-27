import type { MouseEvent } from 'react'
import { getStatisticLeaderboardHref } from './profileRouting'
import type { ProfileStatDefinition } from './profileStats'

export type CorrelationRanking = {
  definition: ProfileStatDefinition
  pearson: number | null
  spearman: number | null
  n: number
}

type CorrelationRankingsProps = {
  rows: CorrelationRanking[]
  season: number
  minimumGames: 20 | 30 | 40
  onMinimumGamesChange: (games: 20 | 30 | 40) => void
  onOpenStatistic: (statKey: string, season: number) => void
}

function formatCorrelation(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—'
  const absolute = Math.abs(value).toFixed(3).replace(/^0/, '')
  if (Math.abs(value) < 0.0005) return absolute
  return `${value > 0 ? '+' : '−'}${absolute}`
}

function relationshipLabel(value: number | null) {
  if (value === null) return 'Unavailable'
  const magnitude = Math.abs(value)
  const strength = magnitude < 0.1
    ? 'Very weak'
    : magnitude < 0.3
      ? 'Weak'
      : magnitude < 0.5
        ? 'Moderate'
        : magnitude < 0.7
          ? 'Strong'
          : 'Very strong'
  if (Math.abs(value) < 0.0005) return strength
  return `${strength} ${value > 0 ? 'positive' : 'negative'}`
}

function CorrelationRankings({
  rows,
  season,
  minimumGames,
  onMinimumGamesChange,
  onOpenStatistic,
}: CorrelationRankingsProps) {
  function handleStatLink(event: MouseEvent<HTMLAnchorElement>, statKey: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onOpenStatistic(statKey, season)
  }

  return (
    <section className="correlation-rankings" aria-labelledby="correlation-rankings-title">
      <header className="correlation-rankings__header">
        <div>
          <p className="profile-eyebrow">R/G vs. Team Avg</p>
          <h2 id="correlation-rankings-title">Strongest Statistical Relationships — {season}</h2>
          <p>All displayed leadoff statistics, ordered by absolute Pearson correlation. The sign preserves the observed direction.</p>
        </div>
        <div className="stat-filter-group">
          <span>Minimum games</span>
          <div className="metric-switch" aria-label="Correlation ranking minimum games">
            {([20, 30, 40] as const).map((games) => (
              <button
                type="button"
                key={games}
                className={minimumGames === games ? 'is-selected' : ''}
                aria-pressed={minimumGames === games}
                onClick={() => onMinimumGamesChange(games)}
              >
                {games}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="correlation-rankings__table-wrap">
        <table className="correlation-rankings__table">
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Statistic</th>
              <th scope="col">Pearson r</th>
              <th scope="col">Relationship</th>
              <th scope="col">Spearman ρ</th>
              <th scope="col">n</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ definition, pearson, spearman, n }, index) => (
              <tr key={definition.key}>
                <td>{index + 1}</td>
                <th scope="row">
                  <a
                    href={getStatisticLeaderboardHref(definition.key, season)}
                    onClick={(event) => handleStatLink(event, definition.key)}
                  >
                    {definition.label}
                  </a>
                </th>
                <td className="correlation-rankings__primary">{formatCorrelation(pearson)}</td>
                <td>{relationshipLabel(pearson)}</td>
                <td>{formatCorrelation(spearman)}</td>
                <td>{n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="correlation-rankings__note">Pearson and Spearman correlations are unweighted and use every qualifying player with a reported statistic and valid scoring differential.</p>
    </section>
  )
}

export default CorrelationRankings
