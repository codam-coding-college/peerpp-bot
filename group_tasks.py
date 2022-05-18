import sys
import codamconnector
from constants import PEERPP_GROUP_ID
from useful.groups import assign_to_group, get_groups_users, remove_from_group
from useful.users import get_user_by_login


def get_usage():
	return f"{sys.argv[0]} <add|remove> [intra_login]"


if len(sys.argv) < 3:
	sys.exit(f"Usage: {get_usage()}")

if sys.argv[1] != "add" and sys.argv[1] != "remove":
	sys.exit(f"Error: unknown option {sys.argv[1]}")

endpoint = codamconnector.IntraConnector()


login = sys.argv[2]
user = get_user_by_login(endpoint, login)
if not user:
	sys.exit(f"Error: user {login} not found")


if sys.argv[1] == "add":
	res = assign_to_group(endpoint, PEERPP_GROUP_ID, user.id)
	if res.status_code == 201: # Created
		print(f"User {login} was added to the Peer++ group")
	elif res.status_code == 422: # Unprocessable Entity
		print(f"User {login} was already in the Peer++ group")
	else:
		print(f"Warning: unexpected server response {res.status_code} while adding {login} to the Peer++ group")
elif sys.argv[1] == "remove":
	groups_users = get_groups_users(endpoint, user.id)
	for groups_user in groups_users:
		if int(groups_user.group.id) == int(PEERPP_GROUP_ID):
			res = remove_from_group(endpoint, groups_user.id)
			if res.status_code == 204: # OK No Content
				print(f"User {login} was removed from the Peer++ group")
			else:
				print(f"Warning: unexpected server response {res.status_code} while removing {login} from the Peer++ group")
			sys.exit(0)
	sys.exit(f"Error: user {login} is not a member of the Peer++ group")
