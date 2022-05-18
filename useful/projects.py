import codamconnector
from constants import PEERPP_BOT_UID
from datetime import timezone, datetime, timedelta
from useful.logger import log_announce, log_print


def get_evals(endpoint, log_file, project_id, scale_id, team_id):
	exchange = codamconnector.Exchange(f"projects/{project_id}/scale_teams?filter[scale_id]={scale_id}&filter[team_id]={team_id}")
	endpoint.get(exchange)
	log_announce(log_file, "Scaleteams")
	log_print(log_file, str(exchange.result))
	return exchange.result


def book_placeholder_eval(endpoint, log_file, scale_id, team_id):
	next_week = datetime.now() + timedelta(days=7)
	scale_team = {"scale_team": {"begin_at": next_week.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M:00 %Z'), "scale_id": str(scale_id), "team_id": str(team_id), "user_id": PEERPP_BOT_UID}}
	exchange = codamconnector.Exchange(f"scale_teams/multiple_create", body=scale_team)
	endpoint.post(exchange)
	log_announce(log_file, 'Created Placeholder Evaluation')
	log_print(log_file, str(exchange.result))
	return exchange.result
