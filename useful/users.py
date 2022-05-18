import codamconnector


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
