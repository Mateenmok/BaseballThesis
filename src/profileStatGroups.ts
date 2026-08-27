export const STANDARD_STAT_KEYS = [
  'AVG', 'OPS', 'OBP', 'SLG', 'wOBA', 'wRC+',
  'BB%', 'K%', 'BB/K', 'O-Swing%', 'Contact%', 'CSW%', 'BsR',
] as const

export const STATCAST_STAT_KEYS = [
  'EV', 'SprintSpeed', 'Barrel%', 'HardHit%', 'xBA', 'xSLG', 'xwOBA',
] as const

export const BATTED_BALL_STAT_KEYS = [
  'LD%', 'GB%', 'FB%', 'Pull%', 'Cent%', 'Oppo%', 'Hard%',
] as const

export const VISIBLE_PROFILE_STAT_KEYS = [
  ...STANDARD_STAT_KEYS,
  ...STATCAST_STAT_KEYS,
  ...BATTED_BALL_STAT_KEYS,
] as const
