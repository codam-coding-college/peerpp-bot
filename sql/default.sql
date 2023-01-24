-- Teams that were booked by the bot but are now expired and should be ignored.
CREATE TABLE IF NOT EXISTS expiredTeam(
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	teamID INTEGER NOT NULL,
	created_at INTEGER DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS evaluators(
	intraUID INTEGER PRIMARY KEY NOT NULL,
	slackUID varchar(512) NOT NULL,
	intraLogin varchar(8) NOT NULL,
	email varchar(512) NOT NULL,
	level INTEGER NOT NULL,
	staff BOOLEAN NOT NULL,
	campusID INTEGER NOT NULL,

	notifyOfNewLock BOOLEAN NOT NULL
);
