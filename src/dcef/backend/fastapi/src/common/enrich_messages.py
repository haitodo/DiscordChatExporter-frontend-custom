import re
from .Database import Database
from .helpers import pad_id

EMOTE_REGEX = re.compile(r'<(a)?:(\w{2,32}):(\d{17,24})>')
ROLE_REGEX = re.compile(r'<@&(\d{17,24})>')
CHANNEL_REGEX = re.compile(r'<#(\d{17,24})>')


def get_emotes_from_db(emotes_ids: list, guild_id: str) -> dict:
	"""
	find emotes from DB by their id, returns mapping of id -> emote document
	"""
	if not emotes_ids:
		return {}
	collection_emojis = Database.get_guild_collection(guild_id, "emojis")
	return {e["_id"]: e for e in collection_emojis.find({"_id": {"$in": emotes_ids}})}


def get_roles_from_db(role_ids: list, guild_id: str) -> dict:
	"""
	find roles from DB by their id, returns mapping of id -> role document
	"""
	if not role_ids:
		return {}
	collection_roles = Database.get_guild_collection(guild_id, "roles")
	return {r["_id"]: r for r in collection_roles.find({"_id": {"$in": role_ids}})}


def get_channels_from_db(channel_ids: list, guild_id: str) -> dict:
	"""
	find channels from DB by their id, returns mapping of id -> channel document
	"""
	if not channel_ids:
		return {}
	collection_channels = Database.get_guild_collection(guild_id, "channels")
	return {c["_id"]: c for c in collection_channels.find({"_id": {"$in": channel_ids}})}


def get_channel_info(channel_id: str, guild_id: str):
	"""
	get channel info by id
	'channel' can be thread or channel or forum post
	"""
	collection_channels = Database.get_guild_collection(guild_id, "channels")
	collection_messages = Database.get_guild_collection(guild_id, "messages")

	channel = collection_channels.find_one({"_id": channel_id})
	if not channel:
		return {
			"type": "GuildPublicThread",
			"name": "Not found",
		}

	channel["msgCount"] = collection_messages.count_documents({"channelId": channel_id})
	return channel


def enrich_messages(list_of_messages: list, guild_id: str) -> list:
	msg_emotes = {}
	msg_roles = {}
	msg_channels = {}
	all_emote_ids = set()
	all_role_ids = set()
	all_channel_ids = set()

	# Single-pass regex parsing across all message contents
	for message in list_of_messages:
		m_id = message["_id"]
		e_ids = []
		r_ids = []
		c_ids = []
		raw_contents = message.get("content", [])
		contents = raw_contents if isinstance(raw_contents, list) else []
		for content in contents:
			if not isinstance(content, dict):
				continue
			text = content.get("content", "")
			if not text:
				continue
			for emote in EMOTE_REGEX.findall(text):
				padded = pad_id(emote[2])
				e_ids.append(padded)
				all_emote_ids.add(padded)
			for role_id in ROLE_REGEX.findall(text):
				padded = pad_id(role_id)
				r_ids.append(padded)
				all_role_ids.add(padded)
			for channel_id in CHANNEL_REGEX.findall(text):
				padded = pad_id(channel_id)
				c_ids.append(padded)
				all_channel_ids.add(padded)
		msg_emotes[m_id] = e_ids
		msg_roles[m_id] = r_ids
		msg_channels[m_id] = c_ids

	emotes_by_id = get_emotes_from_db(list(all_emote_ids), guild_id)
	roles_by_id = get_roles_from_db(list(all_role_ids), guild_id)
	channels_by_id = get_channels_from_db(list(all_channel_ids), guild_id)

	thread_info_cache = {}
	for message in list_of_messages:
		m_id = message["_id"]
		message["emotes"] = [emotes_by_id[eid] for eid in msg_emotes.get(m_id, []) if eid in emotes_by_id]
		message["roles"] = [roles_by_id[rid] for rid in msg_roles.get(m_id, []) if rid in roles_by_id]
		message["channels"] = [channels_by_id[cid] for cid in msg_channels.get(m_id, []) if cid in channels_by_id]

		if message.get("type") == "ThreadCreated" and "reference" in message:
			ref_cid = message["reference"].get("channelId")
			if ref_cid:
				if ref_cid not in thread_info_cache:
					thread_info_cache[ref_cid] = get_channel_info(ref_cid, guild_id)
				message["thread"] = thread_info_cache[ref_cid]

	return list_of_messages


def message_ids_to_messages(guild_id, message_ids: list):
	"""
	Convert message ids to messages.
	"""
	if not message_ids:
		return []

	collection_messages = Database.get_guild_collection(guild_id, "messages")
	denylisted_user_ids = Database.get_denylisted_user_ids()

	messages = collection_messages.find(
		{
			"_id": {
				"$in": message_ids
			},
			"author._id": {
				"$nin": denylisted_user_ids
			}
		}
	)
	return list(messages)


def enrich_messages_with_referenced(list_of_messages: list, guild_id: str):
	ref_messageids = set()
	for message in list_of_messages:
		if "reference" in message and "messageId" in message["reference"]:
			ref_messageids.add(message["reference"]["messageId"])

	ref_messages = message_ids_to_messages(guild_id, list(ref_messageids)) if ref_messageids else []
	all_messages = ref_messages + list_of_messages

	# enriching messages is a heavy operation - run it only once for initial list + referenced messages
	enriched_all_messages = enrich_messages(all_messages, guild_id)
	enriched_all_messages_lookup = {str(message["_id"]): message for message in enriched_all_messages}

	list_of_messages_enriched = [enriched_all_messages_lookup.get(str(message["_id"]), message) for message in list_of_messages]

	for message in list_of_messages_enriched:
		if "reference" in message and "messageId" in message["reference"]:
			message["reference"]["message"] = enriched_all_messages_lookup.get(message["reference"]["messageId"], None)

	return list_of_messages_enriched