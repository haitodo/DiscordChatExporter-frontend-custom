from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import datetime
from ..common.Database import Database, pad_id

router = APIRouter(
	prefix="",
	tags=["bookmarks"]
)

# グローバルデータベースのインスタンスを取得
db = Database.get_global_collection("config").database

class BookmarkCreateRequest(BaseModel):
	guild_id: str
	channel_id: str
	message_id: str
	note: str = ""

class BookmarkUpdateRequest(BaseModel):
	note: str

class CheckpointRequest(BaseModel):
	guild_id: str
	channel_id: str
	message_id: str
	timestamp: str

class CompletedChannelRequest(BaseModel):
	guild_id: str
	channel_id: str

@router.get("/bookmarks")
async def get_bookmarks(guild_id: str | None = None, channel_id: str | None = None):
	"""
	すべてのブックマーク、またはギルド/チャンネルでフィルタリングされたブックマークを取得します。
	"""
	query = {}
	if guild_id:
		query["guild_id"] = pad_id(guild_id)
	if channel_id:
		query["channel_id"] = pad_id(channel_id)
	
	bookmarks = list(db["bookmarks"].find(query).sort("created_at", -1))
	
	# MongoDBのObjectIdをシリアライズ可能な文字列に変換します
	for b in bookmarks:
		b["_id"] = str(b["_id"])
	return bookmarks

@router.post("/bookmarks")
async def create_bookmark(req: BookmarkCreateRequest):
	"""
	新しいブックマークを作成します。メッセージ情報もスナップショットとして保存します。
	"""
	guild_id = pad_id(req.guild_id)
	channel_id = pad_id(req.channel_id)
	message_id = pad_id(req.message_id)

	# ギルドのメッセージコレクションから対象メッセージを取得します
	try:
		collection_messages = Database.get_guild_collection(guild_id, "messages")
	except Exception as e:
		raise HTTPException(status_code=400, detail=f"Invalid guild: {str(e)}")

	message = collection_messages.find_one({"_id": message_id})
	if not message:
		raise HTTPException(status_code=404, detail="メッセージが見つかりませんでした")

	# ギルド名を取得
	guild = db["guilds"].find_one({"_id": guild_id})
	guild_name = guild["name"] if guild else "不明なサーバー"

	# チャンネル名を取得
	collection_channels = Database.get_guild_collection(guild_id, "channels")
	channel = collection_channels.find_one({"_id": channel_id})
	channel_name = channel["name"] if channel else "不明なチャンネル"

	bookmark_id = f"{guild_id}_{message_id}"
	bookmark = {
		"_id": bookmark_id,
		"guild_id": guild_id,
		"guild_name": guild_name,
		"channel_id": channel_id,
		"channel_name": channel_name,
		"message_id": message_id,
		"note": req.note,
		"message": message,
		"created_at": datetime.datetime.utcnow().isoformat()
	}

	db["bookmarks"].replace_one({"_id": bookmark_id}, bookmark, upsert=True)
	return {"status": "success", "bookmark_id": bookmark_id}

@router.patch("/bookmarks/{guild_id}/{message_id}")
async def update_bookmark(guild_id: str, message_id: str, req: BookmarkUpdateRequest):
	"""
	ブックマークのメモ（コメント）を更新します。
	"""
	guild_id = pad_id(guild_id)
	message_id = pad_id(message_id)
	bookmark_id = f"{guild_id}_{message_id}"

	result = db["bookmarks"].update_one(
		{"_id": bookmark_id},
		{"$set": {"note": req.note}}
	)
	if result.matched_count == 0:
		raise HTTPException(status_code=404, detail="ブックマークが見つかりませんでした")
	return {"status": "success"}

@router.delete("/bookmarks/{guild_id}/{message_id}")
async def delete_bookmark(guild_id: str, message_id: str):
	"""
	ブックマークを削除します。
	"""
	guild_id = pad_id(guild_id)
	message_id = pad_id(message_id)
	bookmark_id = f"{guild_id}_{message_id}"

	db["bookmarks"].delete_one({"_id": bookmark_id})
	return {"status": "success"}

@router.get("/checkpoints")
async def get_checkpoints():
	"""
	すべての読了チェックポイントを取得します。進捗データ（既読メッセージ数と総メッセージ数）も計算して付与します。
	"""
	checkpoints = list(db["checkpoints"].find().sort("updated_at", -1))
	
	try:
		denylisted_user_ids = Database.get_denylisted_user_ids()
	except Exception:
		denylisted_user_ids = []

	for cp in checkpoints:
		cp["_id"] = str(cp["_id"])
		
		# 進捗率の計算
		guild_id = cp.get("guild_id")
		channel_id = cp.get("channel_id")
		message_id = cp.get("message_id")
		if guild_id and channel_id and message_id:
			try:
				collection_messages = Database.get_guild_collection(guild_id, "messages")
				
				# チェックポイント以前の既読メッセージ数をカウント（除外ユーザーを除く）
				read_count = collection_messages.count_documents({
					"channelId": channel_id,
					"author._id": {"$nin": denylisted_user_ids},
					"_id": {"$lte": message_id}
				})
				
				# チャンネル全体の総メッセージ数をカウント（除外ユーザーを除く）
				total_count = collection_messages.count_documents({
					"channelId": channel_id,
					"author._id": {"$nin": denylisted_user_ids}
				})
				
				cp["read_count"] = read_count
				cp["total_count"] = total_count
			except Exception:
				cp["read_count"] = 0
				cp["total_count"] = 0
		else:
			cp["read_count"] = 0
			cp["total_count"] = 0
			
	return checkpoints

@router.put("/checkpoints")
async def set_checkpoint(req: CheckpointRequest):
	"""
	読了チェックポイントを設定（作成または更新）します。
	"""
	guild_id = pad_id(req.guild_id)
	channel_id = pad_id(req.channel_id)
	message_id = pad_id(req.message_id)

	checkpoint_id = f"{guild_id}_{channel_id}"

	# ギルド名を取得
	guild = db["guilds"].find_one({"_id": guild_id})
	guild_name = guild["name"] if guild else "不明なサーバー"

	# チャンネル名を取得
	try:
		collection_channels = Database.get_guild_collection(guild_id, "channels")
		channel = collection_channels.find_one({"_id": channel_id})
		channel_name = channel["name"] if channel else "不明なチャンネル"
	except:
		channel_name = "不明なチャンネル"

	checkpoint = {
		"_id": checkpoint_id,
		"guild_id": guild_id,
		"guild_name": guild_name,
		"channel_id": channel_id,
		"channel_name": channel_name,
		"message_id": message_id,
		"timestamp": req.timestamp,
		"updated_at": datetime.datetime.utcnow().isoformat()
	}

	db["checkpoints"].replace_one({"_id": checkpoint_id}, checkpoint, upsert=True)
	return {"status": "success", "checkpoint_id": checkpoint_id}

@router.delete("/checkpoints/{guild_id}/{channel_id}")
async def delete_checkpoint(guild_id: str, channel_id: str):
	"""
	読了チェックポイントを削除します。
	"""
	guild_id = pad_id(guild_id)
	channel_id = pad_id(channel_id)
	checkpoint_id = f"{guild_id}_{channel_id}"

	db["checkpoints"].delete_one({"_id": checkpoint_id})
	return {"status": "success"}

@router.get("/completed-channels")
async def get_completed_channels():
	"""
	すべての読了完了チャンネル/スレッドを取得します。
	"""
	completed = list(db["completed_channels"].find())
	for c in completed:
		c["_id"] = str(c["_id"])
	return completed

@router.put("/completed-channels")
async def mark_channel_completed(req: CompletedChannelRequest):
	"""
	チャンネル/スレッドを読了完了としてマークします。
	"""
	guild_id = pad_id(req.guild_id)
	channel_id = pad_id(req.channel_id)
	completed_id = f"{guild_id}_{channel_id}"

	# ギルド名を取得
	guild = db["guilds"].find_one({"_id": guild_id})
	guild_name = guild["name"] if guild else "不明なサーバー"

	# チャンネル名を取得
	try:
		collection_channels = Database.get_guild_collection(guild_id, "channels")
		channel = collection_channels.find_one({"_id": channel_id})
		channel_name = channel["name"] if channel else "不明なチャンネル"
	except Exception:
		channel_name = "不明なチャンネル"

	doc = {
		"_id": completed_id,
		"guild_id": guild_id,
		"guild_name": guild_name,
		"channel_id": channel_id,
		"channel_name": channel_name,
		"completed_at": datetime.datetime.utcnow().isoformat()
	}

	db["completed_channels"].replace_one({"_id": completed_id}, doc, upsert=True)
	return {"status": "success", "completed_id": completed_id}

@router.delete("/completed-channels/{guild_id}/{channel_id}")
async def unmark_channel_completed(guild_id: str, channel_id: str):
	"""
	チャンネル/スレッドの読了完了マークを解除します。
	"""
	guild_id = pad_id(guild_id)
	channel_id = pad_id(channel_id)
	completed_id = f"{guild_id}_{channel_id}"

	db["completed_channels"].delete_one({"_id": completed_id})
	return {"status": "success"}
