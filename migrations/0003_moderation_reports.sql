PRAGMA foreign_keys = ON;

CREATE TABLE moderation_reports (
  id TEXT PRIMARY KEY,
  reporter_profile_id TEXT NOT NULL,
  reported_player_id TEXT NOT NULL,
  room TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL CHECK (reason IN ('spam','abuse','harassment','cheating','other')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY(reporter_profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX idx_moderation_reports_reporter
  ON moderation_reports(reporter_profile_id, created_at DESC);
