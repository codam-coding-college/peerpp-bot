CREATE TABLE IF NOT EXISTS expiredLocks(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scaleteamID INTEGER NOT NULL,
  created_at INTEGER DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS currentLocks(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scaleteamID INTEGER NOT NULL,
  created_at INTEGER DEFAULT (datetime('now', 'localtime'))
);

-- INSERT INTO blob(scaleteam) VALUES(3);
-- SELECT * FROM blob