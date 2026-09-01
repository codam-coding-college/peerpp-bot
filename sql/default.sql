-- Teams the bot has handled and must ignore from now on: their Peer++ lock is gone,
-- whether it was booked by an evaluator, expired, or removed. Despite the name, most
-- of these did not expire.
CREATE TABLE IF NOT EXISTS expiredTeam(
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	teamID INTEGER NOT NULL,
	created_at INTEGER DEFAULT (datetime('now', 'localtime'))
);

-- Peer++ evaluators that used a notify command, so their favorites can be linked to them.
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

-- Projects an evaluator marked as favorite, used to decide who to notify of a new team waiting for a Peer++ evaluation.
CREATE TABLE IF NOT EXISTS favorites(
	intraUID INTEGER NOT NULL,
	projectName varchar(512) NOT NULL,

	PRIMARY KEY(intraUID, projectName)
);

-- Avoid duplicate deliveries.
CREATE TABLE IF NOT EXISTS webhookDeliveries(
	delivery varchar(1024) PRIMARY KEY NOT NULL,
	body varchar(65535) NOT NULL
)
