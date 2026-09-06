from fastapi import APIRouter, Query

from .Autocomplete import MAX_AUTOCOMPLETE_INPUT_LENGTH, MAX_AUTOCOMPLETE_LIMIT
from ..common.helpers import pad_id
from . import Autocomplete

router = APIRouter(
	prefix="",
	tags=["search"]
)


@router.get("/guild/search/autocomplete")
def search_autocomplete(
	guild_id: str,
	key: str = Query(default=None),
	value: str = Query(default=None, max_length=MAX_AUTOCOMPLETE_INPUT_LENGTH),
	limit: int = Query(default=MAX_AUTOCOMPLETE_LIMIT, ge=1, le=MAX_AUTOCOMPLETE_LIMIT),
):
	if (key == None or value == None):
		return []

	padded_guild_id = pad_id(guild_id)

	if (key == "users"):
		return Autocomplete.autocomplete_users(padded_guild_id, value, limit)
	elif (key == "filenames"):
		return Autocomplete.autocomplete_filenames(padded_guild_id, value, limit)
	elif (key == "extensions"):
		return Autocomplete.autocomplete_extensions(padded_guild_id, value, limit)
	elif (key == "reactions"):
		return Autocomplete.autocomplete_reactions(padded_guild_id, value, limit)
	elif (key == "channels"):
		return Autocomplete.autocomplete_channels(padded_guild_id, value, limit)
	elif (key == "categories"):
		return Autocomplete.autocomplete_categories(padded_guild_id, value, limit)
	elif (key == "has"):
		return Autocomplete.autocomplete_has(padded_guild_id, value, limit)
	else:
		return []
