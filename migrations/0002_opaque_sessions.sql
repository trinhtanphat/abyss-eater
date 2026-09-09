PRAGMA foreign_keys = ON;

CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  session_version INTEGER NOT NULL CHECK (session_version >= 1),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_profile
  ON sessions(profile_id, status, expires_at DESC);

CREATE INDEX idx_sessions_expiry
  ON sessions(status, expires_at ASC);
