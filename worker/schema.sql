PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'bearer',
  scope TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS titles (
  trakt_id INTEGER NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie','show')),
  title TEXT NOT NULL,
  year INTEGER,
  runtime_minutes INTEGER,
  genres_json TEXT NOT NULL DEFAULT '[]',
  people_json TEXT NOT NULL DEFAULT '[]',
  poster_url TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (trakt_id, media_type)
);

CREATE TABLE IF NOT EXISTS watch_events (
  event_id INTEGER PRIMARY KEY,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie','episode')),
  trakt_id INTEGER NOT NULL,
  show_trakt_id INTEGER,
  title TEXT NOT NULL,
  show_title TEXT,
  year INTEGER,
  season INTEGER,
  episode INTEGER,
  watched_at TEXT NOT NULL,
  runtime_minutes INTEGER,
  rating INTEGER,
  raw_json TEXT NOT NULL,
  synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_watch_events_watched_at ON watch_events(watched_at);
CREATE INDEX IF NOT EXISTS idx_watch_events_title ON watch_events(trakt_id, media_type);
CREATE INDEX IF NOT EXISTS idx_watch_events_show ON watch_events(show_trakt_id);
CREATE TABLE IF NOT EXISTS sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_sync_at TEXT,
  last_event_id INTEGER,
  last_error TEXT
);
INSERT OR IGNORE INTO sync_state (id) VALUES (1);
