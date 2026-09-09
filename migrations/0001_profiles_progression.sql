PRAGMA foreign_keys = ON;

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 20),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0 CHECK(xp >= 0),
  level INTEGER NOT NULL DEFAULT 1 CHECK(level BETWEEN 1 AND 50),
  pearls INTEGER NOT NULL DEFAULT 0 CHECK(pearls >= 0),
  selected_skin_id TEXT NOT NULL DEFAULT 'reef-glow',
  best_mass REAL NOT NULL DEFAULT 1 CHECK(best_mass >= 0),
  best_score INTEGER NOT NULL DEFAULT 0 CHECK(best_score >= 0),
  games_played INTEGER NOT NULL DEFAULT 0 CHECK(games_played >= 0),
  total_eaten INTEGER NOT NULL DEFAULT 0 CHECK(total_eaten >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'disabled')),
  session_version INTEGER NOT NULL DEFAULT 1 CHECK(session_version >= 1)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY CHECK(length(id) = 64),
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK(expires_at > created_at),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1)
);

CREATE INDEX idx_sessions_profile_expiry ON sessions(profile_id, expires_at);

CREATE TABLE skins (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  unlock_level INTEGER NOT NULL CHECK(unlock_level BETWEEN 1 AND 50),
  pearl_cost INTEGER NOT NULL CHECK(pearl_cost >= 0),
  body_color INTEGER NOT NULL,
  accent_color INTEGER NOT NULL,
  emissive REAL NOT NULL CHECK(emissive BETWEEN 0 AND 1),
  roughness REAL NOT NULL CHECK(roughness BETWEEN 0 AND 1)
);

INSERT INTO skins (id, title, unlock_level, pearl_cost, body_color, accent_color, emissive, roughness) VALUES
  ('reef-glow', 'Reef Glow', 1, 0, 3332561, 9435118, 0.28, 0.42),
  ('coral-runner', 'Coral Runner', 3, 40, 16741741, 16762222, 0.22, 0.50),
  ('abyss-veil', 'Abyss Veil', 8, 120, 4282367, 10390783, 0.12, 0.66);

CREATE TABLE profile_skins (
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skin_id TEXT NOT NULL REFERENCES skins(id),
  unlocked_at INTEGER NOT NULL,
  PRIMARY KEY (profile_id, skin_id)
);

CREATE TRIGGER profile_skin_purchase_guard
BEFORE INSERT ON profile_skins
WHEN NEW.skin_id <> 'reef-glow'
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM skins WHERE id = NEW.skin_id)
      THEN RAISE(ABORT, 'unknown_skin')
    WHEN (SELECT level FROM profiles WHERE id = NEW.profile_id) <
         (SELECT unlock_level FROM skins WHERE id = NEW.skin_id)
      THEN RAISE(ABORT, 'level_locked')
    WHEN (SELECT pearls FROM profiles WHERE id = NEW.profile_id) <
         (SELECT pearl_cost FROM skins WHERE id = NEW.skin_id)
      THEN RAISE(ABORT, 'insufficient_pearls')
  END;
END;

CREATE TRIGGER profile_skin_purchase_charge
AFTER INSERT ON profile_skins
WHEN NEW.skin_id <> 'reef-glow'
BEGIN
  UPDATE profiles
  SET pearls = pearls - (SELECT pearl_cost FROM skins WHERE id = NEW.skin_id),
      updated_at = MAX(updated_at, NEW.unlocked_at)
  WHERE id = NEW.profile_id;
END;

CREATE TABLE reward_events (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  xp INTEGER NOT NULL CHECK(xp BETWEEN 0 AND 5000),
  pearls INTEGER NOT NULL CHECK(pearls BETWEEN 0 AND 25),
  best_mass REAL NOT NULL CHECK(best_mass BETWEEN 0 AND 1000000),
  best_score INTEGER NOT NULL CHECK(best_score BETWEEN 0 AND 1000000000),
  games_delta INTEGER NOT NULL CHECK(games_delta BETWEEN 0 AND 1),
  total_eaten_delta INTEGER NOT NULL CHECK(total_eaten_delta BETWEEN 0 AND 100),
  season TEXT NOT NULL CHECK(length(season) BETWEEN 1 AND 32),
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_reward_events_profile_created ON reward_events(profile_id, created_at DESC);

CREATE TABLE leaderboard_entries (
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK(scope IN ('all-time', 'seasonal')),
  season TEXT NOT NULL DEFAULT '',
  best_score INTEGER NOT NULL DEFAULT 0 CHECK(best_score >= 0),
  best_mass REAL NOT NULL DEFAULT 1 CHECK(best_mass >= 0),
  games_played INTEGER NOT NULL DEFAULT 0 CHECK(games_played >= 0),
  total_eaten INTEGER NOT NULL DEFAULT 0 CHECK(total_eaten >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (profile_id, scope, season)
);

CREATE INDEX idx_leaderboard_rank
  ON leaderboard_entries(scope, season, best_score DESC, best_mass DESC, updated_at ASC);

CREATE TRIGGER reward_event_apply_profile
AFTER INSERT ON reward_events
BEGIN
  UPDATE profiles
  SET xp = xp + NEW.xp,
      level = MIN(50, 1 + CAST((xp + NEW.xp) / 1000 AS INTEGER)),
      pearls = pearls + NEW.pearls,
      best_mass = MAX(best_mass, NEW.best_mass),
      best_score = MAX(best_score, NEW.best_score),
      games_played = games_played + NEW.games_delta,
      total_eaten = total_eaten + NEW.total_eaten_delta,
      updated_at = MAX(updated_at, NEW.created_at)
  WHERE id = NEW.profile_id;

  INSERT INTO leaderboard_entries
    (profile_id, scope, season, best_score, best_mass, games_played, total_eaten, updated_at)
  VALUES
    (NEW.profile_id, 'all-time', '', NEW.best_score, NEW.best_mass,
     NEW.games_delta, NEW.total_eaten_delta, NEW.created_at)
  ON CONFLICT(profile_id, scope, season) DO UPDATE SET
    best_score = MAX(best_score, excluded.best_score),
    best_mass = MAX(best_mass, excluded.best_mass),
    games_played = games_played + excluded.games_played,
    total_eaten = total_eaten + excluded.total_eaten,
    updated_at = MAX(updated_at, excluded.updated_at);

  INSERT INTO leaderboard_entries
    (profile_id, scope, season, best_score, best_mass, games_played, total_eaten, updated_at)
  VALUES
    (NEW.profile_id, 'seasonal', NEW.season, NEW.best_score, NEW.best_mass,
     NEW.games_delta, NEW.total_eaten_delta, NEW.created_at)
  ON CONFLICT(profile_id, scope, season) DO UPDATE SET
    best_score = MAX(best_score, excluded.best_score),
    best_mass = MAX(best_mass, excluded.best_mass),
    games_played = games_played + excluded.games_played,
    total_eaten = total_eaten + excluded.total_eaten,
    updated_at = MAX(updated_at, excluded.updated_at);
END;
