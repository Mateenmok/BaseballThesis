import { useMemo, useState, type MouseEvent } from 'react'
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
import {
  SEASONS,
  getTeamColor,
  getTextColorOnTeamColor,
  type Season,
} from './data'
import {
  MIN_LEADOFF_GAMES,
  formatRunsPerGameDelta,
  formatWinningPercentage,
  getLeagueLeaders,
  getQualifiedLeadoffHitters,
  type LeaderboardEntry,
  type LeaderboardMetric,
} from './leaderboard'
import { PLAYER_SEASONS } from './playerData'
import type { PlayerSeason } from './playerData'
import { getPlayerProfileHref } from './profileRouting'

type LeagueLeadersProps = {
  season: Season
  onSeasonChange: (season: Season) => void
  onOpenPlayer: (player: PlayerSeason) => void
}

type ScatterPoint = LeaderboardEntry & {
  teamColor: string
  xValue: number
}

type ScatterXAxisMode = 'absolute' | 'differential'

type ScatterTooltipProps = {
  active?: boolean
  payload?: Array<{ payload: ScatterPoint }>
}

function ScatterTooltip({ active, payload }: ScatterTooltipProps) {
  const player = payload?.[0]?.payload
  if (!active || !player) return null

  return (
    <div className="scatter-tooltip">
      <div className="scatter-tooltip__identity">
        <span style={{ backgroundColor: player.teamColor }} aria-hidden="true" />
        <strong>{player.name}</strong>
        <small>{player.team}</small>
      </div>
      <dl>
        <div><dt>G</dt><dd>{player.leadoffGames}</dd></div>
        <div><dt>Team W–L</dt><dd>{player.teamWins}–{player.teamLosses}</dd></div>
        <div><dt>Leadoff R/G</dt><dd>{player.teamRunsPerGame.toFixed(2)}</dd></div>
        <div><dt>Team Season R/G</dt><dd>{player.teamSeasonRunsPerGame.toFixed(2)}</dd></div>
        <div><dt>Δ R/G</dt><dd>{formatRunsPerGameDelta(player.runsPerGameDelta)}</dd></div>
        <div><dt>Team Win%</dt><dd>{formatWinningPercentage(player.winPercentage)}</dd></div>
      </dl>
    </div>
  )
}

function LeagueLeaders({ season, onSeasonChange, onOpenPlayer }: LeagueLeadersProps) {
  const [metric, setMetric] = useState<LeaderboardMetric>('runsPerGame')
  const [xAxisMode, setXAxisMode] = useState<ScatterXAxisMode>('absolute')

  const qualifiedPlayers = useMemo(
    () => getQualifiedLeadoffHitters(PLAYER_SEASONS, season),
    [season],
  )

  const leaders = useMemo(
    () => getLeagueLeaders(PLAYER_SEASONS, season, metric),
    [metric, season],
  )

  const isRunsMetric = metric === 'runsPerGame'
  const isWinningMetric = metric === 'winPercentage'
  const isDeltaMetric = metric === 'runsPerGameDelta'
  const isDifferentialMode = xAxisMode === 'differential'
  const title = `Team Outcomes by Leadoff Hitter — ${season}`
  const subtitle = isDifferentialMode
    ? `Δ R/G vs. each team's season scoring average · Minimum ${MIN_LEADOFF_GAMES} games · Dot size represents starts`
    : `Team R/G vs. Team winning percentage in each player's leadoff starts · Minimum ${MIN_LEADOFF_GAMES} games · Dot size represents starts`
  const scatterData: ScatterPoint[] = qualifiedPlayers.map((player) => ({
    ...player,
    teamColor: getTeamColor(player.team),
    xValue: isDifferentialMode ? player.runsPerGameDelta : player.teamRunsPerGame,
  }))
  const xValues = scatterData.map(({ xValue }) => xValue)
  const maximumAbsoluteDelta = Math.max(0.1, ...xValues.map(Math.abs))
  const differentialExtent = Math.ceil((maximumAbsoluteDelta + 0.05) * 10) / 10
  const absoluteMinimum = xValues.length > 0
    ? Math.floor((Math.min(...xValues) - 0.15) * 10) / 10
    : 0
  const absoluteMaximum = xValues.length > 0
    ? Math.ceil((Math.max(...xValues) + 0.15) * 10) / 10
    : 1
  const xDomain: [number, number] = isDifferentialMode
    ? [-differentialExtent, differentialExtent]
    : [absoluteMinimum, absoluteMaximum]
  const tableData = leaders.map((player, index) => ({
    ...player,
    rank: index + 1,
  }))

  function handlePlayerLink(event: MouseEvent<HTMLAnchorElement>, player: PlayerSeason) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onOpenPlayer(player)
  }

  return (
    <section className="league-leaders" aria-labelledby="leaderboard-title">
      <div className="league-controls">
        <div className="league-season-field">
          <label htmlFor="league-season">Season</label>
          <div className="select-wrap">
            <select
              id="league-season"
              value={season}
              onChange={(event) => onSeasonChange(Number(event.target.value) as Season)}
            >
              {SEASONS.map((availableSeason) => (
                <option key={availableSeason} value={availableSeason}>{availableSeason}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-ranking-control">
          <span>Rank table by</span>
          <div className="metric-switch" role="group" aria-label="Table ranking metric">
            <button
              type="button"
              className={isRunsMetric ? 'is-selected' : ''}
              aria-pressed={isRunsMetric}
              onClick={() => setMetric('runsPerGame')}
            >
              Team R/G
            </button>
            <button
              type="button"
              className={isWinningMetric ? 'is-selected' : ''}
              aria-pressed={isWinningMetric}
              onClick={() => setMetric('winPercentage')}
            >
              Winning %
            </button>
            <button
              type="button"
              className={isDeltaMetric ? 'is-selected' : ''}
              aria-pressed={isDeltaMetric}
              onClick={() => setMetric('runsPerGameDelta')}
            >
              Δ R/G
            </button>
          </div>
        </div>
      </div>

      <header className="leaderboard-header">
        <h2 id="leaderboard-title">{title}</h2>
        <p>{subtitle}</p>
      </header>

      {qualifiedPlayers.length === 0 ? (
        <p className="empty-state">No qualifying leadoff hitters for this season.</p>
      ) : (
        <>
          <figure className="leaderboard-figure" aria-labelledby="leaderboard-title">
            <div className="scatter-mode-control">
              <span>X-axis</span>
              <div className="metric-switch" role="group" aria-label="Scatterplot X-axis">
                <button
                  type="button"
                  className={!isDifferentialMode ? 'is-selected' : ''}
                  aria-pressed={!isDifferentialMode}
                  onClick={() => setXAxisMode('absolute')}
                >
                  Absolute R/G
                </button>
                <button
                  type="button"
                  className={isDifferentialMode ? 'is-selected' : ''}
                  aria-pressed={isDifferentialMode}
                  onClick={() => setXAxisMode('differential')}
                >
                  vs Team Average
                </button>
              </div>
            </div>
            <div
              className="leaderboard-chart"
              role="img"
              aria-label={`${title}. ${qualifiedPlayers.length} qualifying players. ${isDifferentialMode ? 'Runs per game differential versus team average' : 'Team runs per game'} on the horizontal axis and team winning percentage on the vertical axis.`}
            >
              <ResponsiveContainer width="100%" height={560}>
                <ScatterChart
                  margin={{ top: 18, right: 24, bottom: 42, left: 24 }}
                >
                  <CartesianGrid stroke="#dedede" strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="xValue"
                    name={isDifferentialMode ? 'Δ R/G vs Team Average' : 'Team R/G'}
                    tickFormatter={(value: number) => isDifferentialMode ? formatRunsPerGameDelta(value) : value.toFixed(1)}
                    domain={xDomain}
                    label={{
                      value: isDifferentialMode ? 'Δ R/G VS TEAM AVERAGE' : 'TEAM R/G',
                      position: 'insideBottom',
                      offset: -24,
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="winPercentage"
                    name="Team Win%"
                    width={54}
                    tickFormatter={(value: number) => formatWinningPercentage(value)}
                    domain={[
                      (minimum: number) => Math.max(0, minimum - 0.035),
                      (maximum: number) => Math.min(1, maximum + 0.035),
                    ]}
                    label={{ value: 'TEAM WIN%', angle: -90, position: 'insideLeft', offset: 8 }}
                  />
                  <ZAxis type="number" dataKey="leadoffGames" range={[48, 220]} name="Starts" />
                  {isDifferentialMode && (
                    <ReferenceLine x={0} stroke="#000" strokeWidth={1.5} />
                  )}
                  <Tooltip content={<ScatterTooltip />} cursor={{ stroke: '#999', strokeDasharray: '3 3' }} />
                  <Scatter data={scatterData} isAnimationActive={false}>
                    {scatterData.map((player) => (
                      <Cell
                        key={`${player.season}-${player.team}-${player.mlbId}`}
                        fill={player.teamColor}
                        fillOpacity={0.82}
                        stroke="#fff"
                        strokeWidth={1}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </figure>

          <div className="leaderboard-table-wrap">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Player</th>
                  <th scope="col">Team</th>
                  <th scope="col">G</th>
                  <th scope="col">Team W–L</th>
                  <th scope="col">Team R/G</th>
                  <th scope="col">Δ R/G</th>
                  <th scope="col">Team Win%</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((player) => (
                  <tr key={`${player.season}-${player.team}-${player.mlbId}`}>
                    <td>{player.rank}</td>
                    <th scope="row">
                      <a
                        className="leaderboard-player-link"
                        href={getPlayerProfileHref(player.fangraphsId as number, player.season)}
                        onClick={(event) => handlePlayerLink(event, player)}
                      >
                        {player.name}
                      </a>
                    </th>
                    <td>
                      <span
                        className="team-color-badge"
                        style={{
                          backgroundColor: getTeamColor(player.team),
                          color: getTextColorOnTeamColor(player.team),
                        }}
                      >
                        {player.team}
                      </span>
                    </td>
                    <td>{player.leadoffGames}</td>
                    <td>{player.teamWins}–{player.teamLosses}</td>
                    <td>{player.teamRunsPerGame.toFixed(2)}</td>
                    <td>{formatRunsPerGameDelta(player.runsPerGameDelta)}</td>
                    <td>{formatWinningPercentage(player.winPercentage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

export default LeagueLeaders
