import { getGuildState } from "./guildState.svelte";

// ブックマークリストのステート
let bookmarksList = $state<any[]>([]);

// チェックポイントマップのステート (キー: "guildId_channelId")
let checkpointsMap = $state<Record<string, any>>({});

/**
 * すべてのブックマークをAPI経由でロードします。
 */
export async function fetchBookmarks() {
    try {
        const response = await fetch('/api/bookmarks');
        if (response.ok) {
            bookmarksList = await response.json();
        }
    } catch (e) {
        console.error("Failed to fetch bookmarks", e);
    }
}

/**
 * 新しいブックマークを追加します。
 */
export async function addBookmark(message: any, note = "") {
    try {
        const response = await fetch('/api/bookmarks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                guild_id: message.guildId,
                channel_id: message.channelId,
                message_id: message._id,
                note
            })
        });
        if (response.ok) {
            await fetchBookmarks();
        }
    } catch (e) {
        console.error("Failed to add bookmark", e);
    }
}

/**
 * ブックマークを削除します。
 */
export async function deleteBookmark(guildId: string, messageId: string) {
    try {
        const response = await fetch(`/api/bookmarks/${guildId}/${messageId}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            await fetchBookmarks();
        }
    } catch (e) {
        console.error("Failed to delete bookmark", e);
    }
}

/**
 * ブックマークのメモを更新します。
 */
export async function updateBookmarkNote(guildId: string, messageId: string, note: string) {
    try {
        const response = await fetch(`/api/bookmarks/${guildId}/${messageId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note })
        });
        if (response.ok) {
            await fetchBookmarks();
        }
    } catch (e) {
        console.error("Failed to update bookmark note", e);
    }
}

/**
 * すべての読了チェックポイントをロードします。
 */
export async function fetchCheckpoints() {
    try {
        const response = await fetch('/api/checkpoints');
        if (response.ok) {
            const list = await response.json();
            const map: Record<string, any> = {};
            for (const cp of list) {
                map[`${cp.guild_id}_${cp.channel_id}`] = cp;
            }
            checkpointsMap = map;
        }
    } catch (e) {
        console.error("Failed to fetch checkpoints", e);
    }
}

/**
 * チャンネルまたはスレッドの読了チェックポイントを設定します。
 */
export async function setCheckpoint(guildId: string, channelId: string, messageId: string, timestamp: string) {
    try {
        const response = await fetch('/api/checkpoints', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                guild_id: guildId,
                channel_id: channelId,
                message_id: messageId,
                timestamp
            })
        });
        if (response.ok) {
            await fetchCheckpoints();
        }
    } catch (e) {
        console.error("Failed to set checkpoint", e);
    }
}

/**
 * ブックマークストアのゲッターおよびヘルパー関数を返します。
 */
export function getBookmarksStore() {
    return {
        get bookmarks() {
            return bookmarksList;
        },
        get checkpoints() {
            return checkpointsMap;
        },
        isBookmarked(guildId: string, messageId: string) {
            return bookmarksList.some(b => b.guild_id === guildId && b.message_id === messageId);
        },
        getBookmark(guildId: string, messageId: string) {
            return bookmarksList.find(b => b.guild_id === guildId && b.message_id === messageId);
        },
        getCheckpoint(guildId: string, channelId: string) {
            return checkpointsMap[`${guildId}_${channelId}`];
        }
    };
}
