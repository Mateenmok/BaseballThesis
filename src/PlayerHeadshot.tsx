import { useEffect, useState } from 'react'
import { getPlayerHeadshotUrl } from './playerHeadshots'

type PlayerHeadshotProps = {
  name: string
  mlbId: number | null
  className?: string
  loading?: 'eager' | 'lazy'
}

function PlayerHeadshot({ name, mlbId, className = '', loading = 'lazy' }: PlayerHeadshotProps) {
  const headshotUrl = getPlayerHeadshotUrl(mlbId)
  const [hasImageError, setHasImageError] = useState(false)

  useEffect(() => setHasImageError(false), [headshotUrl])

  if (!headshotUrl || hasImageError) {
    return (
      <div
        className={`player-headshot player-headshot--fallback ${className}`.trim()}
        role="img"
        aria-label={`No headshot available for ${name}`}
      >
        <span aria-hidden="true" />
      </div>
    )
  }

  return (
    <img
      className={`player-headshot ${className}`.trim()}
      src={headshotUrl}
      alt={`${name} headshot`}
      loading={loading}
      onError={() => setHasImageError(true)}
    />
  )
}

export default PlayerHeadshot
