import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const LINEUP_WRC_PLUS = [
  { position: 1, value: 110.3 },
  { position: 2, value: 112.2 },
  { position: 3, value: 111.2 },
  { position: 4, value: 105.4 },
  { position: 5, value: 98.1 },
  { position: 6, value: 96.7 },
  { position: 7, value: 93.8 },
  { position: 8, value: 85.2 },
  { position: 9, value: 79.8 },
]

type LandingPageProps = {
  onBegin: () => void
}

function LandingChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value?: number }>
  label?: number
}) {
  if (!active || !payload?.[0]?.value) return null

  return (
    <div className="landing-chart__tooltip">
      <span>Batting {label}</span>
      <strong>{payload[0].value.toFixed(1)} wRC+</strong>
    </div>
  )
}

function LandingPage({ onBegin }: LandingPageProps) {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <p className="landing-brand">MokMetrics</p>
        <h1>Analyzing MLB lineup construction</h1>
      </header>

      <div className="landing-content">
        <section className="landing-evidence" aria-labelledby="lineup-chart-title">
          <div className="landing-chart__heading">
            <h2 id="lineup-chart-title">2026 MLB wRC+ by Batting Order Position</h2>
            <p>Offensive production declines as hitters move lower in the batting order</p>
          </div>

          <div className="landing-chart" aria-label="Line chart of wRC+ by batting order position">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={LINEUP_WRC_PLUS} margin={{ top: 18, right: 18, bottom: 8, left: 0 }}>
                <CartesianGrid stroke="#dedede" vertical={false} />
                <XAxis
                  dataKey="position"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#3e3e3e', fontSize: 13 }}
                  label={{ value: 'Batting Order Position', position: 'insideBottom', offset: -3, fontSize: 14, fontWeight: 500 }}
                />
                <YAxis
                  domain={[75, 115]}
                  ticks={[80, 85, 90, 95, 100, 105, 110, 115]}
                  axisLine={false}
                  tickLine={false}
                  width={38}
                  tick={{ fill: '#3e3e3e', fontSize: 12 }}
                  label={{ value: 'wRC+', angle: -90, position: 'insideLeft', offset: 10, fontSize: 14, fontWeight: 500 }}
                />
                <ReferenceLine y={100} stroke="#111" strokeDasharray="6 5" />
                <Tooltip content={<LandingChartTooltip />} cursor={{ stroke: '#aaa', strokeDasharray: '3 3' }} />
                <Line
                  type="linear"
                  dataKey="value"
                  stroke="#111"
                  strokeWidth={3}
                  dot={{ r: 4.5, fill: '#111', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#111', stroke: '#fff', strokeWidth: 2 }}
                  label={{ dataKey: 'value', position: 'top', fill: '#111', fontSize: 12, offset: 8 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <p className="landing-chart__source">Source: FanGraphs Splits Leaderboards</p>
          <p className="landing-finding">
            In the 2026 split data, the first four lineup spots produced above-average offense by wRC+.
          </p>
        </section>

        <section className="landing-focuses" aria-labelledby="research-focuses-title">
          <div>
            <h2 id="research-focuses-title">Research Focuses</h2>
            <ol>
              <li>Which part of the MLB batting order is the most impactful?</li>
              <li>Among players who bat in those spots, do any of their attributes lead to increased team success?</li>
              <li>Is there an “optimal” way to order an MLB batting lineup?</li>
            </ol>
          </div>

          <button className="landing-next" type="button" onClick={onBegin}>
            <span>1.</span> Leadoff Batter <span aria-hidden="true">→</span>
          </button>
        </section>
      </div>
    </main>
  )
}

export default LandingPage
