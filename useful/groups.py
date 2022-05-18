import codamconnector


def assign_to_group(endpoint, group_id, user_id):
	groups_user = {"groups_user": {"group_id": group_id, "user_id": user_id}}
	exchange = codamconnector.Exchange(f"groups_users", body=groups_user)
	endpoint.post(exchange)
	return exchange.response


def remove_from_group(endpoint, groups_user_id):
	exchange = codamconnector.Exchange(f"groups_users/{groups_user_id}")
	endpoint.delete(exchange)
	return exchange.response


def get_groups_users(endpoint, user_id):
	exchange = codamconnector.Exchange(f"users/{user_id}/groups_users")
	endpoint.get(exchange)
	return exchange.result
