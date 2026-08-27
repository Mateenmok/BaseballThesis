import type { CSSProperties } from 'react'
import { MIN_LEADOFF_GAMES } from './leaderboard'
import { PLAYER_SEASONS, type PlayerSeason } from './playerData'
import { getPercentileStyle } from './profileStats'

type TeamStatisticsProps = {
  player?: PlayerSeason
}

type TeamMetric = {
  key: string
  label: string
  position: number | null
  formattedValue: string
}

function leaderboardPercentile(value: number | null, comparisonValues: number[]) {
  if (value === null || comparisonValues.length === 0) return null
  const atOrBelow = comparisonValues.filter((comparison) => comparison <= value).length
  return (atOrBelow / comparisonValues.length) * 100
}

function formatWinningPercentage(value: number | null) {
  return value === null ? '—' : value.toFixed(3).replace(/^0/, '')
}

function formatDelta(value: number | null, digits: number, omitLeadingZero = false) {
  if (value === null) return '—'
  if (Math.abs(value) < 0.5 * 10 ** -digits) return digits === 3 ? '.000' : '0.00'
  const formatted = Math.abs(value).toFixed(digits)
  const absolute = omitLeadingZero ? formatted.replace(/^0/, '') : formatted
  return `${value > 0 ? '+' : '−'}${absolute}`
}

function TeamMetricBar({ metric }: { metric: TeamMetric }) {
  const position = metric.position
  const markerStyle = getPercentileStyle(position, 'higher')
  const style = {
    '--team-metric-position': `${position ?? 0}%`,
    '--team-metric-color': markerStyle.backgroundColor,
  } as CSSProperties

  return (
    <div className="profile-team-metric">
      <div className="profile-team-metric__label">
        <span>{metric.label}</span>
        <strong>{metric.formattedValue}</strong>
      </div>
      <div
        className={`profile-team-metric__track ${position === null ? 'is-missing' : ''}`}
        style={style}
        role="img"
        aria-label={`${metric.label}: ${metric.formattedValue}`}
      >
        {position !== null && (
          <span
            className="profile-team-metric__marker"
            style={{
              ...markerStyle,
              left: `clamp(9px, ${position}%, calc(100% - 9px))`,
            }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  )
}

function TeamStatistics({ player }: TeamStatisticsProps) {
  const eligiblePlayers = player
    ? PLAYER_SEASONS.filter((candidate) =>
        candidate.season === player.season &&
        candidate.leadoffGames !== null &&
        candidate.leadoffGames >= MIN_LEADOFF_GAMES)
    : []

  function comparisonValues(field: keyof PlayerSeason) {
    return eligiblePlayers
      .map((candidate) => candidate[field])
      .filter((value): value is number => typeof value === 'number')
  }

  const metrics: TeamMetric[] = [
    {
      key: 'runs',
      label: 'Team R/G',
      position: leaderboardPercentile(
        player?.teamRunsPerGame ?? null,
        comparisonValues('teamRunsPerGame'),
      ),
      formattedValue: player?.teamRunsPerGame?.toFixed(2) ?? '—',
    },
    {
      key: 'wins',
      label: 'Team Win%',
      position: leaderboardPercentile(
        player?.teamWinPercentage ?? null,
        comparisonValues('teamWinPercentage'),
      ),
      formattedValue: formatWinningPercentage(player?.teamWinPercentage ?? null),
    },
    {
      key: 'runs-delta',
      label: 'R/G vs. Team Avg',
      position: leaderboardPercentile(
        player?.runsPerGameDelta ?? null,
        comparisonValues('runsPerGameDelta'),
      ),
      formattedValue: formatDelta(player?.runsPerGameDelta ?? null, 2),
    },
    {
      key: 'wins-delta',
      label: 'Win% vs. Team Avg',
      position: leaderboardPercentile(
        player?.winPercentageDelta ?? null,
        comparisonValues('winPercentageDelta'),
      ),
      formattedValue: formatDelta(player?.winPercentageDelta ?? null, 3, true),
    },
  ]

  return (
    <section className="profile-team-stats" aria-labelledby="team-statistics-heading">
      <header>
        <p className="profile-eyebrow">In leadoff starts</p>
        <h2 id="team-statistics-heading">Team Statistics</h2>
        <div className="profile-team-scale" aria-hidden="true">
          <span>Poor</span><span>Average</span><span>Great</span>
        </div>
      </header>
      <div className="profile-team-metrics">
        {metrics.map((metric) => <TeamMetricBar key={metric.key} metric={metric} />)}
      </div>
    </section>
  )
}

export default TeamStatistics
