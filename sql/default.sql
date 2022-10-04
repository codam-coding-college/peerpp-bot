CREATE TABLE IF NOT EXISTS expiredLocks(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scaleteamID INTEGER NOT NULL,
  created_at INTEGER DEFAULT (datetime('now', 'localtime'))
);

-- TODO: Keep track of locked evaluations here maybe too ? For now intra suffers as usual.
-- INSERT INTO blob(scaleteam) VALUES(3);
-- SELECT * FROM blob