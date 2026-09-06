import type { Bookmark, Checkpoint, CompletedChannel, Message } from "../interfaces";

type ApiRequest = RequestInit & { method: "POST" | "PUT" | "PATCH" | "DELETE" };

let bookmarksList = $state<Bookmark[]>([]);
let checkpointsMap = $state<Record<string, Checkpoint>>({});
let completedChannelsMap = $state<Record<string, CompletedChannel>>({});

function entityKey(guildId: string, channelId: string): string {
    return `${guildId}_${channelId}`;
}

async function fetchList<T>(url: string): Promise<T[]> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return await response.json() as T[];
}

async function mutateAndRefresh(
    url: string,
    request: ApiRequest,
    refresh: () => Promise<void>,
    errorMessage: string,
): Promise<void> {
    try {
        const response = await fetch(url, request);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        await refresh();
    } catch (error) {
        console.error(errorMessage, error);
    }
}

export async function fetchBookmarks(): Promise<void> {
    try {
        bookmarksList = await fetchList<Bookmark>("/api/bookmarks");
    } catch (error) {
        console.error("Failed to fetch bookmarks", error);
    }
}

export async function addBookmark(message: Message, note = ""): Promise<void> {
    await mutateAndRefresh("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            guild_id: message.guildId,
            channel_id: message.channelId,
            message_id: message._id,
            note,
        }),
    }, fetchBookmarks, "Failed to add bookmark");
}

export async function deleteBookmark(guildId: string, messageId: string): Promise<void> {
    await mutateAndRefresh(`/api/bookmarks/${guildId}/${messageId}`, {
        method: "DELETE",
    }, fetchBookmarks, "Failed to delete bookmark");
}

export async function updateBookmarkNote(guildId: string, messageId: string, note: string): Promise<void> {
    await mutateAndRefresh(`/api/bookmarks/${guildId}/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
    }, fetchBookmarks, "Failed to update bookmark note");
}

export async function fetchCheckpoints(): Promise<void> {
    try {
        const checkpoints = await fetchList<Checkpoint>("/api/checkpoints");
        checkpointsMap = Object.fromEntries(
            checkpoints.map(checkpoint => [
                entityKey(checkpoint.guild_id, checkpoint.channel_id),
                checkpoint,
            ])
        );
    } catch (error) {
        console.error("Failed to fetch checkpoints", error);
    }
}

export async function setCheckpoint(guildId: string, channelId: string, messageId: string, timestamp: string): Promise<void> {
    await mutateAndRefresh("/api/checkpoints", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            guild_id: guildId,
            channel_id: channelId,
            message_id: messageId,
            timestamp,
        }),
    }, fetchCheckpoints, "Failed to set checkpoint");
}

export async function deleteCheckpoint(guildId: string, channelId: string): Promise<void> {
    await mutateAndRefresh(`/api/checkpoints/${guildId}/${channelId}`, {
        method: "DELETE",
    }, fetchCheckpoints, "Failed to delete checkpoint");
}

export async function fetchCompletedChannels(): Promise<void> {
    try {
        const completedChannels = await fetchList<CompletedChannel>("/api/completed-channels");
        completedChannelsMap = Object.fromEntries(
            completedChannels.map(channel => [
                entityKey(channel.guild_id, channel.channel_id),
                channel,
            ])
        );
    } catch (error) {
        console.error("Failed to fetch completed channels", error);
    }
}

export async function markChannelCompleted(guildId: string, channelId: string): Promise<void> {
    await mutateAndRefresh("/api/completed-channels", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            guild_id: guildId,
            channel_id: channelId,
        }),
    }, fetchCompletedChannels, "Failed to mark channel completed");
}

export async function unmarkChannelCompleted(guildId: string, channelId: string): Promise<void> {
    await mutateAndRefresh(`/api/completed-channels/${guildId}/${channelId}`, {
        method: "DELETE",
    }, fetchCompletedChannels, "Failed to unmark channel completed");
}

export function getBookmarksStore() {
    return {
        get bookmarks(): Bookmark[] {
            return bookmarksList;
        },
        get checkpoints(): Record<string, Checkpoint> {
            return checkpointsMap;
        },
        get completedChannels(): Record<string, CompletedChannel> {
            return completedChannelsMap;
        },
        isBookmarked(guildId: string, messageId: string): boolean {
            return bookmarksList.some(bookmark =>
                bookmark.guild_id === guildId && bookmark.message_id === messageId
            );
        },
        getBookmark(guildId: string, messageId: string): Bookmark | undefined {
            return bookmarksList.find(bookmark =>
                bookmark.guild_id === guildId && bookmark.message_id === messageId
            );
        },
        getCheckpoint(guildId: string, channelId: string): Checkpoint | undefined {
            return checkpointsMap[entityKey(guildId, channelId)];
        },
        isCompleted(guildId: string, channelId: string): boolean {
            return completedChannelsMap[entityKey(guildId, channelId)] !== undefined;
        },
    };
}
