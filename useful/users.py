import codamconnector
from constants import CURSUS_ID


def get_user(endpoint, uid):
	exchange = codamconnector.Exchange(f"users/{uid}")
	endpoint.get(exchange)
	return exchange.result


def get_user_by_login(endpoint, login):
	exchange = codamconnector.Exchange(f"users?filter[login]={login}")
	endpoint.get(exchange)
	if len(exchange.result) > 0:
		return exchange.result[0]
	return None


def get_intra_uid_by_login(endpoint, login):
	user = get_user_by_login(endpoint, login)
	if not user:
		return None
	return user.id


def get_cursus_from_user(cursus_id, cursus_users):
	for cursus_user in cursus_users:
		if cursus_user.cursus_id == cursus_id:
			return cursus_user


def get_user_level(user):
	cursus = get_cursus_from_user(CURSUS_ID, user.cursus_users)
	if cursus:
		return cursus.level
	else:
		return -42
