CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  first_seen TEXT,
  last_seen TEXT,
  purchased INTEGER NOT NULL DEFAULT 0 CHECK (purchased IN (0, 1)),
  purchased_at TEXT
);

CREATE INDEX users_last_seen_idx ON users(last_seen);

CREATE TABLE daily_activity (
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  PRIMARY KEY (user_id, day)
);

CREATE INDEX daily_activity_day_idx ON daily_activity(day);
