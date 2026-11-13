CREATE TABLE IF NOT EXISTS overrides (
 id TEXT PRIMARY KEY, scope TEXT NOT NULL, gender TEXT NOT NULL,
 round_name TEXT NOT NULL, heat_title TEXT NOT NULL, surfer_name TEXT NOT NULL,
 country TEXT NOT NULL, fields_json TEXT NOT NULL, reason TEXT NOT NULL,
 updated_at TEXT NOT NULL, revision TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit (
 seq INTEGER PRIMARY KEY AUTOINCREMENT, target_id TEXT NOT NULL,
 action TEXT NOT NULL, before_json TEXT, after_json TEXT,
 reason TEXT NOT NULL, changed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS login_limits (
 bucket TEXT PRIMARY KEY, failures INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
