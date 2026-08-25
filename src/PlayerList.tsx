import type { MouseEvent } from 'react'
import PlayerHeadshot from './PlayerHeadshot'
import type { PlayerSeason } from './playerData'
import { getPlayerProfileHref } from './profileRouting'

type PlayerListProps = {
  players: PlayerSeason[]
  onOpenPlayer: (player: PlayerSeason) => void
}

function PlayerList({ players, onOpenPlayer }: PlayerListProps) {
  if (players.length === 0) {
    return <p className="empty-state">No players found for this team and season.</p>
  }

  function handlePlayerLink(event: MouseEvent<HTMLAnchorElement>, player: PlayerSeason) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onOpenPlayer(player)
  }

  return (
    <ul className="player-list">
      {players.map((player) => (
        <li key={`${player.season}-${player.team}-${player.mlbId ?? player.fangraphsId ?? player.name}`}>
          <a
            className="player-entry"
            href={getPlayerProfileHref(player.fangraphsId as number, player.season)}
            onClick={(event) => handlePlayerLink(event, player)}
          >
            <PlayerHeadshot name={player.name} mlbId={player.mlbId} />
            <div className="player-entry__content">
              <h3>{player.name}</h3>
              <dl className="player-stats">
                <div>
                  <dt>G</dt>
                  <dd>{player.leadoffGames ?? player.games}</dd>
                </div>
                <div>
                  <dt>PA</dt>
                  <dd>{player.plateAppearances}</dd>
                </div>
                <div className="player-stat--record">
                  <dt>TEAM W–L</dt>
                  <dd>
                    {player.teamWins !== null && player.teamLosses !== null
                      ? `${player.teamWins}–${player.teamLosses}`
                      : '—'}
                  </dd>
                </div>
                <div className="player-stat--runs">
                  <dt>TEAM R/G</dt>
                  <dd>{player.teamRunsPerGame?.toFixed(1) ?? '—'}</dd>
                </div>
              </dl>
            </div>
          </a>
        </li>
      ))}
    </ul>
  )
}

export default PlayerList
