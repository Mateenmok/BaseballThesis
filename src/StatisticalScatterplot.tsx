import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { getTeamColor } from './data'
import PlayerHeadshot from './PlayerHeadshot'
import type { PlayerProfileData } from './playerProfileData'
import type { PlayerSeason } from './playerData'
import {
  formatProfileStatValue,
  getStatAnalysisScale,
  type ProfileStatDefinition,
  type StatAnalysisScale,
} from './profileStats'
import { analyzeRelationship } from './statistics'

type OutcomeMetric = 'runsDelta' | 'winDelta'

type StatisticalScatterplotEntry = {
  player: PlayerSeason
  profile: PlayerProfileData
  value: number
}

type StatisticalScatterplotProps = {
  entries: StatisticalScatterplotEntry[]
  definition: ProfileStatDefinition
  season: number
  onOpenPlayer: (player: PlayerSeason) => void
  analysisScale?: StatAnalysisScale
  allowWinOutcome?: boolean
}

type ScatterPoint = StatisticalScatterplotEntry & {
  games: number
  teamColor: string
  xValue: number
  yValue: number
}

type ScatterTooltipProps = {
  active?: boolean
  payload?: Array<{ payload: ScatterPoint }>
  definition: ProfileStatDefinition
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

function formatSignedStatistic(value: number | null, digits = 3) {
  if (value === null || !Number.isFinite(value)) return '—'
  const absolute = Math.abs(value).toFixed(digits).replace(/^0/, '')
  if (Math.abs(value) < 0.5 * 10 ** -digits) return absolute
  return `${value > 0 ? '+' : '−'}${absolute}`
}

function formatPValue(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—'
  if (value < 0.001) return '<.001'
  return value.toFixed(3).replace(/^0/, '')
}

function StatisticalScatterTooltip({ active, payload, definition }: ScatterTooltipProps) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null

  return (
    <div className="scatter-tooltip stat-scatter-tooltip">
      <div className="stat-scatter-tooltip__player">
        <PlayerHeadshot name={point.profile.name} mlbId={point.profile.mlbId} />
        <div>
          <strong>{point.profile.name}</strong>
          <small>{point.player.team}</small>
        </div>
      </div>
      <dl>
        <div><dt>{definition.label}</dt><dd>{formatProfileStatValue(point.value, definition.format)}</dd></div>
        <div><dt>G</dt><dd>{point.games}</dd></div>
        <div><dt>PA</dt><dd>{point.player.plateAppearances}</dd></div>
        <div><dt>Team R/G</dt><dd>{point.player.teamRunsPerGame?.toFixed(2) ?? '—'}</dd></div>
        <div><dt>R/G vs. Avg</dt><dd>{formatDelta(point.player.runsPerGameDelta, 2)}</dd></div>
        <div><dt>Team Win%</dt><dd>{formatWinningPercentage(point.player.teamWinPercentage)}</dd></div>
        <div><dt>Win% vs. Avg</dt><dd>{formatDelta(point.player.winPercentageDelta, 3, true)}</dd></div>
      </dl>
    </div>
  )
}

function paddedDomain(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1]
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const span = maximum - minimum
  const padding = span > 0 ? span * 0.06 : Math.max(Math.abs(minimum) * 0.06, 0.05)
  return [minimum - padding, maximum + padding]
}

function symmetricDomain(values: number[]): [number, number] {
  const extent = Math.max(0.01, ...values.map((value) => Math.abs(value)))
  return [-extent * 1.08, extent * 1.08]
}

function StatisticalScatterplot({
  entries,
  definition,
  season,
  onOpenPlayer,
  analysisScale: analysisScaleOverride,
  allowWinOutcome = true,
}: StatisticalScatterplotProps) {
  const [outcome, setOutcome] = useState<OutcomeMetric>('runsDelta')
  const isRunsOutcome = outcome === 'runsDelta'

  useEffect(() => {
    setOutcome('runsDelta')
  }, [allowWinOutcome, definition.key, season])

  const points = useMemo(() => entries.flatMap((entry): ScatterPoint[] => {
    const yValue = isRunsOutcome
      ? entry.player.runsPerGameDelta
      : entry.player.winPercentageDelta
    if (yValue === null) return []
    return [{
      ...entry,
      games: entry.player.leadoffGames ?? entry.player.games,
      teamColor: getTeamColor(entry.player.team),
      xValue: entry.value,
      yValue,
    }]
  }), [entries, isRunsOutcome])

  const scoringPoints = useMemo(() => entries.flatMap((entry): ScatterPoint[] => {
    const yValue = entry.player.runsPerGameDelta
    const games = entry.player.leadoffGames ?? entry.player.games
    if (yValue === null || !Number.isFinite(entry.value) || !Number.isFinite(yValue) || games <= 0) return []
    return [{
      ...entry,
      games,
      teamColor: getTeamColor(entry.player.team),
      xValue: entry.value,
      yValue,
    }]
  }), [entries])

  const analysis = useMemo(() => analyzeRelationship(scoringPoints.map(({ xValue, yValue, games }) => ({
    x: xValue,
    y: yValue,
    weight: games,
  }))), [scoringPoints])

  const xDomain = paddedDomain(points.map(({ xValue }) => xValue))
  const yDomain = symmetricDomain(points.map(({ yValue }) => yValue))
  const outcomeLabel = isRunsOutcome ? 'R/G vs. Team Avg' : 'Win% vs. Team Avg'
  const title = `${definition.label} vs. Team ${isRunsOutcome ? 'Scoring' : 'Winning Percentage'} Differential — ${season}`
  const analysisScale = analysisScaleOverride ?? getStatAnalysisScale(definition)
  const regression = analysis.regression
  const slope = regression ? regression.slope * analysisScale.increment : null
  const slopeInterval = regression
    ? regression.slopeConfidenceInterval.map((value) => value * analysisScale.increment)
    : null
  const observedXValues = scoringPoints.map(({ xValue }) => xValue)
  const regressionSegment: readonly [{ x: number, y: number }, { x: number, y: number }] | null =
    regression && observedXValues.length > 0
      ? [
        {
          x: Math.min(...observedXValues),
          y: regression.intercept + regression.slope * Math.min(...observedXValues),
        },
        {
          x: Math.max(...observedXValues),
          y: regression.intercept + regression.slope * Math.max(...observedXValues),
        },
      ]
      : null

  return (
    <figure className="stat-scatter" aria-labelledby="stat-scatter-title">
      <div className="stat-scatter__heading">
        <div>
          <h3 id="stat-scatter-title">{title}</h3>
          <p>Each point is one qualifying leadoff hitter. Team differential compares those starts with the team&apos;s full-season average.</p>
        </div>
        {allowWinOutcome && (
          <div className="stat-scatter__outcome-control">
            <span>Team outcome</span>
            <div className="metric-switch" role="group" aria-label="Scatterplot team outcome">
              <button
                type="button"
                className={isRunsOutcome ? 'is-selected' : ''}
                aria-pressed={isRunsOutcome}
                onClick={() => setOutcome('runsDelta')}
              >
                R/G vs. Team Avg
              </button>
              <button
                type="button"
                className={!isRunsOutcome ? 'is-selected' : ''}
                aria-pressed={!isRunsOutcome}
                onClick={() => setOutcome('winDelta')}
              >
                Win% vs. Team Avg
              </button>
            </div>
          </div>
        )}
      </div>

      {isRunsOutcome && (
        <section className="stat-relationship-summary" aria-label="Relationship summary">
          <div className="stat-relationship-summary__intro">
            <span>Relationship summary</span>
            <p>Correlations are unweighted. The linear regression is weighted by qualifying leadoff G.</p>
          </div>
          <dl>
            <div><dt>Pearson r</dt><dd>{formatSignedStatistic(analysis.pearson)}</dd></div>
            <div><dt>Spearman ρ</dt><dd>{formatSignedStatistic(analysis.spearman)}</dd></div>
            <div>
              <dt>Weighted slope ({analysisScale.label})</dt>
              <dd>{slope === null ? '—' : `${formatSignedStatistic(slope)} R/G`}</dd>
            </div>
            <div>
              <dt>95% CI</dt>
              <dd>{slopeInterval ? `${formatSignedStatistic(slopeInterval[0])} to ${formatSignedStatistic(slopeInterval[1])}` : '—'}</dd>
            </div>
            <div><dt>p-value</dt><dd>{formatPValue(regression?.pValue ?? null)}</dd></div>
            <div><dt>n</dt><dd>{analysis.n}</dd></div>
          </dl>
        </section>
      )}

      {points.length === 0 ? (
        <p className="empty-state">No players have both the selected statistic and team-outcome data.</p>
      ) : (
        <div
          className="stat-scatter__chart"
          role="img"
          aria-label={`${title}. ${points.length} qualifying players. ${definition.label} on the horizontal axis and ${outcomeLabel} on the vertical axis.`}
        >
          <ResponsiveContainer width="100%" height={520}>
            <ScatterChart margin={{ top: 18, right: 28, bottom: 42, left: 28 }}>
              <CartesianGrid stroke="#dedede" strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="xValue"
                name={definition.label}
                domain={xDomain}
                tickFormatter={(value: number) => formatProfileStatValue(value, definition.format)}
                label={{ value: definition.label.toLocaleUpperCase(), position: 'insideBottom', offset: -24 }}
              />
              <YAxis
                type="number"
                dataKey="yValue"
                name={outcomeLabel}
                width={66}
                domain={yDomain}
                tickFormatter={(value: number) => formatDelta(value, isRunsOutcome ? 2 : 3, !isRunsOutcome)}
                label={{ value: outcomeLabel.toLocaleUpperCase(), angle: -90, position: 'insideLeft', offset: 2 }}
              />
              <ZAxis type="number" dataKey="games" range={[52, 150]} name="Leadoff G" />
              <ReferenceLine y={0} stroke="#111" strokeWidth={1.5} />
              {isRunsOutcome && regressionSegment && (
                <ReferenceLine
                  segment={regressionSegment}
                  stroke="#4d4d4d"
                  strokeWidth={2}
                  strokeDasharray="7 5"
                  ifOverflow="extendDomain"
                />
              )}
              <Tooltip
                content={<StatisticalScatterTooltip definition={definition} />}
                cursor={{ stroke: '#999', strokeDasharray: '3 3' }}
              />
              <Scatter
                data={points}
                isAnimationActive={false}
                onClick={(point) => {
                  const selectedPoint = point as unknown as { payload?: ScatterPoint }
                  if (selectedPoint.payload) onOpenPlayer(selectedPoint.payload.player)
                }}
              >
                {points.map((point) => (
                  <Cell
                    key={`${point.profile.season}-${point.profile.playerId}`}
                    fill={point.teamColor}
                    fillOpacity={0.84}
                    stroke="#fff"
                    strokeWidth={1.25}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
      <figcaption>
        {points.length} players plotted
        {entries.length > points.length && ` · ${entries.length - points.length} omitted without ${outcomeLabel} data`}
        {' · '}Dot size represents qualifying leadoff G
      </figcaption>
    </figure>
  )
}

export default StatisticalScatterplot
