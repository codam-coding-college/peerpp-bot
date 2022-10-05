-- Evaluations that were locked but expired
CREATE TABLE IF NOT EXISTS expiredLocks(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scaleteamID INTEGER NOT NULL,
  created_at INTEGER DEFAULT (datetime('now', 'localtime'))
);
