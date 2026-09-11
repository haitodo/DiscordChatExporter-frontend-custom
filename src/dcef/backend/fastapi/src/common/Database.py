import time
import threading
import pymongo

URI = "mongodb://127.0.0.1:27017"
client = pymongo.MongoClient(URI)
db = client["dcef"]
collection_guilds = db["guilds"]
collection_config = db["config"]

def pad_id(id):
	if id == None:
		return None
	return str(id).zfill(24)

# Lightweight thread-safe TTL cache for config values to avoid repeated sync DB queries
_config_cache = {}
_config_cache_lock = threading.Lock()
CONFIG_CACHE_TTL = 10.0  # seconds

def _get_cached_config(key: str) -> list:
	now = time.time()
	with _config_cache_lock:
		cached = _config_cache.get(key)
		if cached is not None:
			val, exp = cached
			if now < exp:
				return val

	doc = collection_config.find_one({"key": key})
	val = [pad_id(item_id) for item_id in (doc["value"] if doc and "value" in doc else [])]

	with _config_cache_lock:
		_config_cache[key] = (val, now + CONFIG_CACHE_TTL)
	return val


class Database:
	@staticmethod
	def is_online():
		try:
			client.server_info()
			return True
		except:
			return False

	@staticmethod
	def get_global_collection(collection_name):
		return db[collection_name]

	@staticmethod
	def clear_config_cache():
		with _config_cache_lock:
			_config_cache.clear()

	@staticmethod
	def get_allowlisted_guild_ids():
		return _get_cached_config("allowlisted_guild_ids")

	@staticmethod
	def get_denylisted_user_ids():
		return _get_cached_config("denylisted_user_ids")

	@staticmethod
	def get_guild_collection(guild_id, collection_name):
		allowlisted_guild_ids = Database.get_allowlisted_guild_ids()
		padded_guild_id = pad_id(guild_id)
		if len(allowlisted_guild_ids) > 0 and padded_guild_id not in allowlisted_guild_ids:
			raise Exception(f"Guild {guild_id} not allowlisted")

		return db[f"g{padded_guild_id}_{collection_name}"]
