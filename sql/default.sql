-- Teams that were booked by the bot but are now expired and should be ignored.
CREATE TABLE IF NOT EXISTS expiredTeam(
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	teamID INTEGER NOT NULL,
	created_at INTEGER DEFAULT (datetime('now', 'localtime'))
);
