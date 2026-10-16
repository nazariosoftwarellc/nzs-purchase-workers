CREATE TABLE app_users (
  app_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  premium INTEGER NOT NULL DEFAULT 0 CHECK (premium IN (0, 1)),
  first_seen TEXT,
  last_seen TEXT,
  PRIMARY KEY (app_id, user_id)
);

CREATE INDEX app_users_last_seen_idx ON app_users(app_id, last_seen);

CREATE TABLE app_daily_activity (
  app_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  PRIMARY KEY (app_id, user_id, day),
  FOREIGN KEY (app_id, user_id) REFERENCES app_users(app_id, user_id) ON DELETE CASCADE
);

CREATE INDEX app_daily_activity_day_idx ON app_daily_activity(app_id, day);
