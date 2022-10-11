-- Evaluations / Teams that were locked but expired, should be ignored for booking.
CREATE TABLE IF NOT EXISTS expiredTeam(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teamID INTEGER NOT NULL,
  scaleteamID INTEGER NOT NULL,
  created_at INTEGER DEFAULT (datetime('now', 'localtime'))
);
