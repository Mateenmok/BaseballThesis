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
}
```

Player data joins this baseline by `season + team` and derives:

```text
Δ R/G = leadoff-start Team R/G − full-season Team R/G
```

For an active season such as 2026, the baseline is season-to-date across final
regular-season games.

`npm run build` regenerates the JSON before compiling the application.

## Player profiles and percentiles

The profile slice uses two canonical CSV sources:

```text
data/master/2023to2026Leadoff_Canonical.csv
data/master/2023to2026Qualified_Canonical.csv
```

Generate profile data with:

```bash
npm run build:profiles
```

The generator validates that `Season + playerId` is unique in both sources. It
reads each displayed value from the leadoff split and compares it only with the
same statistic and season in the qualified-hitter file. Percentiles use
deterministic midranks; lower-is-better statistics are inverted to performance
percentiles, while descriptive statistics retain their raw distribution
percentiles. Generated browser data lives at:

```text
src/data/generated/player-profiles.json
```

The shared stat/category definitions are in `src/data/profile-stats.json`.
Player profile URLs use the canonical FanGraphs `playerId` and season, for
example `/player/19755/2024`. MLBAMID remains the headshot identity.

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
