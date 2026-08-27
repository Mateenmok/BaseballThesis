# BaseballThesis

A minimal React application for selecting an MLB team and season and viewing matching player-season rows from the project's master workbook.

## Data workflow

The Excel source of truth lives at:

```text
data/master/player-data.xlsx
```

To update the website data, replace that workbook and run:

```bash
npm run build:data
```

The command reads the `Combined Data` worksheet, validates the required columns and team abbreviations, converts numeric values, rejects duplicate player/team/season identities, and writes the normalized dataset to:

```text
src/data/generated/players.json
```

Each generated workbook row contains:

```ts
{
  season: number
  name: string
  team: string
  games: number
  plateAppearances: number
  fangraphsId: number | null
  mlbId: number | null
}
```

At runtime, those identity and batting fields are joined to the numeric leadoff
analysis fields in `src/data/generated/leadoff-metrics.json`:

```ts
{
  games: number
  wins: number
  losses: number
  averageTeamRuns: number
}
```

The same generation command also writes one reusable scoring baseline per team
and season to `src/data/generated/team-season-runs.json`:

```ts
{
  season: number
  team: string
  games: number
  runs: number
  runsPerGame: number
  wins: number
  losses: number
  winPercentage: number | null
}
```

Player data joins this baseline by `season + team` and derives:

```text
Δ R/G = leadoff-start Team R/G − full-season Team R/G
Δ Win% = leadoff-start Team Win% − full-season Team Win%
```

The profile's Team Statistics bars place each value within the same-season
leaderboard pool of players with at least 20 leadoff starts. The season leader
therefore reaches the right edge of the scale.

For an active season such as 2026, the baseline is season-to-date across final
regular-season games.

Run `npm run build:metrics` to refresh these MLB-derived files; `npm run build`
then compiles the application with the generated metrics.

The same metrics task emits one compact observation for every matched leadoff
start to `src/data/generated/leadoff-game-results.json`. Schedule rows are
deduplicated by MLB `gamePk`, which prevents postponed or rescheduled listings
from counting the same game twice.

## Player profiles and percentiles

The profile slice uses two canonical CSV sources plus season-specific Sprint
Speed and BsR exports:

```text
data/master/2023to2026Leadoff_Canonical.csv
data/master/2023to2026Qualified_Canonical.csv
data/master/sprint-speed/2023.csv
data/master/sprint-speed/2024.csv
data/master/sprint-speed/2025.csv
data/master/sprint-speed/2026.csv
data/master/bsr/2023.csv
data/master/bsr/2024.csv
data/master/bsr/2025.csv
data/master/bsr/2026.csv
```

Generate profile data with:

```bash
npm run build:profiles
```

The generator validates that `Season + playerId` is unique in both canonical
sources, joins Sprint Speed by `Season + MLBAMID/player_id`, and joins BsR by
`Season + playerId/PlayerId`. Canonical statistics come from the leadoff split;
Sprint Speed and season-level BsR come from their corresponding external
exports. Each value is compared only with the same statistic and season in the
qualified-hitter population. Percentiles use
deterministic midranks; lower-is-better statistics are inverted to performance
percentiles, while descriptive statistics retain their raw distribution
percentiles. Generated browser data lives at:

```text
src/data/generated/player-profiles.json
```

The shared stat/category definitions are in `src/data/profile-stats.json`.
Player profile URLs use the canonical FanGraphs `playerId` and season, for
example `/player/19755/2024`. MLBAMID remains the headshot identity.

Every visible profile statistic links to a season-specific statistical
leaderboard at `/stats/:season/:statKey`. The page supports statistic search,
season selection, Top 20 and Bottom 20 rankings, a 20/30/40-game minimum,
optional Win% columns, player-profile links, team-outcome context, and the
metric definitions maintained in `src/statDefinitions.ts`. For inverse
metrics such as K% and CSW%, Top 20 follows performance direction and therefore
ranks lower values first.

## Leadoff game outcomes

The player cards also show the team's record and average runs scored in games in
which that player started in the leadoff spot. These values are derived from
official MLB schedules and boxscores and written to:

```text
src/data/generated/leadoff-metrics.json
```

Generate missing metrics with:

```bash
npm run build:metrics
```

Responses are cached under `data/cache/mlb/` so subsequent runs do not repeatedly
request historical boxscores. During an active season, refresh its schedule before
regenerating the metrics:

```bash
npm run build:metrics -- --refresh-season=2026
```

The calculation only counts final regular-season games. MLB batting order `100`
identifies the player who started in the leadoff lineup slot; later substitutes
are excluded.

## Leadoff swap analysis

`/swaps/:season` compares qualifying leadoff-hitter pairs within the same team
and season. Both hitters must have at least 40 matched starts. Pairs qualify
when the root-mean-square distance across their same-season Qualified raw
percentiles for OBP, ISO, BB%, Contact%, Hard-Hit%, and Sprint Speed is at
least 25, with at least two component gaps of 25 percentile points or more.

Each pair shows the observed difference in Team R/G and Team Win%, player-level
team-average context, and the six percentile components. When the compact
game observations reproduce both aggregate samples, the page also reports a
seeded 10,000-iteration independent bootstrap interval for the R/G difference
and a two-sided label-permutation p-value.

## League leaders

The League Leaders view ranks up to 20 players for each supported season by
team runs per game, team winning percentage, or Δ R/G in their leadoff starts. The
qualification threshold is centralized as `MIN_LEADOFF_GAMES = 20` in
`src/leaderboard.ts`. Winning percentage is derived from numeric outcomes as
`wins / (wins + losses)`.

The scatterplot uses Recharts, the project's only chart dependency. Its X-axis
can switch between absolute leadoff-start Team R/G and Δ R/G versus the team's
season average; Team Win% remains on the Y-axis. The chart is loaded only when
League Leaders is opened so Team Explorer stays on the smaller initial bundle.

## Development

```bash
npm install
npm run dev
```
