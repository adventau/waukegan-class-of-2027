-- Everything people send in through the site's forms.
-- status: pending -> approved | rejected (photos, spotlights, directory, announcements)
--         new -> done (contact messages, newsletter sign-ups)
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,            -- photo | contact | spotlight | directory | announcement | newsletter
  status TEXT NOT NULL,
  data TEXT NOT NULL,            -- JSON of the form fields
  file_key TEXT,                 -- key in the FILES KV store, if a file was attached
  file_type TEXT,
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);
CREATE INDEX submissions_type_status ON submissions (type, status, created_at);

-- Anonymous page counts: a path, a day, a number. Nothing else.
CREATE TABLE visits (
  day TEXT NOT NULL,
  path TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path)
);

-- Errors from visitors' browsers and from the server.
CREATE TABLE errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  source TEXT NOT NULL,          -- browser | server
  path TEXT,
  message TEXT NOT NULL,
  detail TEXT
);

-- On/off switches and editable content, stored as JSON by key.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Admin sign-in attempts, for slowing down password guessing.
CREATE TABLE login_attempts (
  ip_hash TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX login_attempts_ip ON login_attempts (ip_hash, at);

-- Class News posts written from the admin page.
CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
