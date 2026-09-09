PRAGMA foreign_keys = ON;

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  pearls INTEGER NOT NULL DEFAULT 0 CHECK (pearls >= 0),
  selected_skin_id TEXT NOT NULL DEFAULT 'reef',
  best_mass REAL NOT NULL DEFAULT 1 CHECK (best_mass >= 1),
  best_score INTEGER NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  games_played INTEGER NOT NULL DEFAULT 0 CHECK (games_played >= 0),
  total_eaten INTEGER NOT NULL DEFAULT 0 CHECK (total_eaten >= 0),
  status TEXT NOT NULL DEFAULT 'active',
  session_version INTEGER NOT NULL DEFAULT 1 CHECK (session_version >= 1)
);

CREATE TABLE profile_skins (
  profile_id TEXT NOT NULL,
  skin_id TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL,
  PRIMARY KEY(profile_id, skin_id),
  FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE reward_events (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  xp INTEGER NOT NULL CHECK (xp >= 0),
  pearls INTEGER NOT NULL CHECK (pearls >= 0),
  created_at INTEGER NOT NULL,
  FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE leaderboard_entries (
  profile_id TEXT NOT NULL,
  season TEXT NOT NULL,
  best_score INTEGER NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  best_mass REAL NOT NULL DEFAULT 1 CHECK (best_mass >= 1),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(profile_id, season),
  FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX idx_leaderboard_rank
  ON leaderboard_entries(season, best_score DESC, best_mass DESC, updated_at ASC);

CREATE INDEX idx_reward_events_profile
  ON reward_events(profile_id, created_at DESC);
