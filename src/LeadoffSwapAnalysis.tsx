import { useMemo } from 'react'
import { SEASONS, getTeamByAbbreviation, type Season } from './data'
import {
  MIN_COMPONENT_GAP,
  MIN_LARGE_COMPONENT_GAPS,
  MIN_PROFILE_DISTANCE,
  MIN_SWAP_LEADOFF_GAMES,
  SWAP_PROFILE_DIMENSIONS,
  getLeadoffSwapPairs,
  type LeadoffSwapPair,
  type SwapPlayer,
} from './leadoffSwaps'
import { formatWinningPercentage } from './leaderboard'
import PlayerHeadshot from './PlayerHeadshot'
import { getPercentileStyle } from './profileStats'
import type { PlayerSeason } from './playerData'

type LeadoffSwapAnalysisProps = {
  season: number
  onNavigateHome: () => void
  onOpenSeason: (season: number) => void
  onOpenPlayer: (player: PlayerSeason) => void
}

function formatSigned(value: number, decimals: number) {
  const threshold = 0.5 * 10 ** -decimals
  if (Math.abs(value) < threshold) return value.toFixed(decimals)
  return `${value > 0 ? '+' : ''}${value.toFixed(decimals)}`
}

function formatSignedWinningPercentage(value: number) {
  if (Math.abs(value) < 0.0005) return '.000'
  const formatted = Math.abs(value).toFixed(3).replace(/^0/, '')
  return `${value > 0 ? '+' : '−'}${formatted}`
}

function formatPValue(value: number) {
  if (value < 0.001) return '< .001'
  return value.toFixed(3).replace(/^0/, '')
}

function PlayerComparisonColumn({
  label,
  player,
  onOpenPlayer,
}: {
  label: string
  player: SwapPlayer
  onOpenPlayer: (player: PlayerSeason) => void
}) {
  return (
    <section className="swap-player" aria-label={`${label}: ${player.name}`}>
      <span className="swap-player__label">{label}</span>
      <button type="button" className="swap-player__identity" onClick={() => onOpenPlayer(player)}>
        <PlayerHeadshot name={player.name} mlbId={player.mlbId} />
        <span>
          <strong>{player.name}</strong>
          <small>View player profile</small>
        </span>
      </button>

      <dl className="swap-player__metrics">
        <div><dt>Leadoff G</dt><dd>{player.leadoffGames}</dd></div>
        <div><dt>PA</dt><dd>{player.plateAppearances}</dd></div>
        <div><dt>Team R/G</dt><dd>{player.teamRunsPerGame.toFixed(2)}</dd></div>
        <div><dt>R/G vs. team avg</dt><dd>{formatSigned(player.runsPerGameDelta, 2)}</dd></div>
        <div><dt>Team Win%</dt><dd>{formatWinningPercentage(player.teamWinPercentage)}</dd></div>
        <div><dt>Win% vs. team avg</dt><dd>{formatSignedWinningPercentage(player.winPercentageDelta)}</dd></div>
      </dl>
    </section>
  )
}

function SwapPairCard({ pair, onOpenPlayer }: {
  pair: LeadoffSwapPair
  onOpenPlayer: (player: PlayerSeason) => void
}) {
  const team = getTeamByAbbreviation(pair.team)

  return (
    <article className="swap-card">
      <header className="swap-card__header">
        <div className="swap-card__team">
          {team && <img src={team.logo} alt="" aria-hidden="true" />}
          <div>
            <span>{pair.season} · {pair.team}</span>
            <h2>{team?.name ?? pair.team}</h2>
          </div>
        </div>
        <dl className="swap-card__headline-metrics">
          <div>
            <dt>Observed Δ R/G · A vs. B</dt>
            <dd>{formatSigned(pair.runsPerGameDifference, 2)}</dd>
          </div>
          <div>
            <dt>Observed Δ Win%</dt>
            <dd>{formatSignedWinningPercentage(pair.winPercentageDifference)}</dd>
          </div>
          <div>
            <dt>Profile distance</dt>
            <dd>{pair.profileDistance.toFixed(1)}</dd>
          </div>
        </dl>
      </header>

      {pair.inference && (
        <div className="swap-card__inference" aria-label="Game-level uncertainty estimates">
          <span>
            <strong>95% bootstrap CI</strong>
            {formatSigned(pair.inference.bootstrapLow, 2)} to {formatSigned(pair.inference.bootstrapHigh, 2)} R/G
          </span>
          <span>
            <strong>Permutation p</strong>
            {formatPValue(pair.inference.permutationPValue)}
          </span>
          <span>{pair.inference.iterations.toLocaleString()} seeded iterations</span>
        </div>
      )}

      <div className="swap-card__players">
        <PlayerComparisonColumn label="Player A" player={pair.playerA} onOpenPlayer={onOpenPlayer} />
        <PlayerComparisonColumn label="Player B" player={pair.playerB} onOpenPlayer={onOpenPlayer} />
      </div>

      <section className="swap-profile-comparison" aria-labelledby={`profile-${pair.id}`}>
        <div className="swap-profile-comparison__heading">
          <div>
            <span>Why this pair qualifies</span>
            <h3 id={`profile-${pair.id}`}>Six-stat profile comparison</h3>
          </div>
          <p>{pair.largeComponentGapCount} of 6 gaps are at least {MIN_COMPONENT_GAP} percentile points.</p>
        </div>

        <div className="swap-profile-table-wrap">
          <table className="swap-profile-table">
            <thead>
              <tr>
                <th scope="col">Profile dimension</th>
                <th scope="col">{pair.playerA.name}</th>
                <th scope="col">{pair.playerB.name}</th>
                <th scope="col">Absolute gap</th>
              </tr>
            </thead>
            <tbody>
              {SWAP_PROFILE_DIMENSIONS.map((dimension, index) => (
                <tr key={dimension.statKey}>
                  <th scope="row">{dimension.label}</th>
                  <td><span style={getPercentileStyle(pair.playerA.profilePercentiles[index], 'higher')}>{Math.round(pair.playerA.profilePercentiles[index])}</span></td>
                  <td><span style={getPercentileStyle(pair.playerB.profilePercentiles[index], 'higher')}>{Math.round(pair.playerB.profilePercentiles[index])}</span></td>
                  <td className={pair.componentGaps[index] >= MIN_COMPONENT_GAP ? 'is-large-gap' : ''}>
                    {pair.componentGaps[index].toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </article>
  )
}

function LeadoffSwapAnalysis({
  season,
  onNavigateHome,
  onOpenSeason,
  onOpenPlayer,
}: LeadoffSwapAnalysisProps) {
  const pairs = useMemo(() => getLeadoffSwapPairs(season), [season])

  return (
    <main className="swap-page">
      <header className="swap-page__hero">
        <button type="button" className="profile-back-link" onClick={onNavigateHome}>← Back to home</button>
        <div className="swap-page__hero-copy">
          <span className="swap-eyebrow">Within-team · within-season</span>
          <h1>Leadoff Swap Analysis</h1>
          <p>
            Compare how the same team performed when two meaningfully different hitters started at leadoff.
            These are observed associations, not causal effects.
          </p>
        </div>

        <label className="swap-season-control" htmlFor="swap-season">
          <span>Season</span>
          <select
            id="swap-season"
            value={season}
            onChange={(event) => onOpenSeason(Number(event.target.value))}
          >
            {SEASONS.map((availableSeason: Season) => (
              <option key={availableSeason} value={availableSeason}>{availableSeason}</option>
            ))}
          </select>
        </label>
      </header>

      <section className="swap-page__methodology">
        <p>
          Qualifying swaps require both hitters to start at least {MIN_SWAP_LEADOFF_GAMES} games at leadoff
          and to differ meaningfully across a six-stat offensive profile.
        </p>
        <details>
          <summary>Profile-distance methodology</summary>
          <div>
            <p>
              The profile uses same-season Qualified raw percentiles for OBP, ISO, BB%, Contact%, Hard-Hit%,
              and Sprint Speed. Distance is the root-mean-square percentile separation across those six dimensions.
            </p>
            <p>
              A pair must have a profile distance of at least {MIN_PROFILE_DISTANCE} and at least {MIN_LARGE_COMPONENT_GAPS}
              dimensions separated by {MIN_COMPONENT_GAP} or more percentile points.
            </p>
          </div>
        </details>
      </section>

      <section className="swap-page__results" aria-live="polite">
        <div className="swap-page__results-heading">
          <div>
            <span>{pairs.length} qualifying {pairs.length === 1 ? 'pair' : 'pairs'}</span>
            <h2>Largest Observed Leadoff R/G Differences</h2>
          </div>
          <p>Sorted by absolute A-vs.-B R/G difference; signs preserve the deterministic player-ID order.</p>
        </div>

        {pairs.length === 0 ? (
          <p className="swap-empty">No qualifying leadoff swaps for this season.</p>
        ) : (
          <div className="swap-pair-list">
            {pairs.map((pair) => (
              <SwapPairCard key={pair.id} pair={pair} onOpenPlayer={onOpenPlayer} />
            ))}
          </div>
        )}
      </section>

      <footer className="swap-page__caveat">
        These comparisons hold team and season constant but do not yet adjust for differences in opponents,
        ballparks, opposing pitchers, injuries, or other lineup changes.
      </footer>
    </main>
  )
}

export default LeadoffSwapAnalysis
