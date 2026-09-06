import type { Category, Channel, ChannelWithThreads, MessagePage } from "../interfaces";

type PageDirection = "before" | "after" | "around" | "first" | "last";

const DEFAULT_GUILD_ID = "000000000000000000000000";
const FIRST_CURSOR = "0";
const LAST_CURSOR = "999999999999999999999999";

const EMPTY_MESSAGE_PAGE: MessagePage = {
    prevPage: null,
    messageIds: [],
    nextPage: null,
    messages: [],
};

function normalizeGuildId(guildId: string | null): string {
    return guildId ?? DEFAULT_GUILD_ID;
}

function normalizeCursor(messageId: string | null): string {
    if (messageId === null || messageId === "first" || messageId === "top") {
        return FIRST_CURSOR;
    }
    if (messageId === "last" || messageId === "bottom") {
        return LAST_CURSOR;
    }
    return messageId;
}

function getCursorParameter(direction: PageDirection, messageId: string | null): [string, string] {
    switch (direction) {
        case "first":
            return ["next_page_cursor", FIRST_CURSOR];
        case "last":
            return ["prev_page_cursor", LAST_CURSOR];
        case "before":
            return ["prev_page_cursor", normalizeCursor(messageId)];
        case "after":
            return ["next_page_cursor", normalizeCursor(messageId)];
        case "around":
            return ["around_page_cursor", normalizeCursor(messageId)];
    }
}

async function fetchPage(
    endpoint: string,
    params: Record<string, string | number>,
    errorMessage: string,
): Promise<MessagePage> {
    try {
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            query.set(key, String(value));
        }
        const response = await fetch(`${endpoint}?${query}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return await response.json() as MessagePage;
    } catch (error) {
        console.error(errorMessage, error);
        return EMPTY_MESSAGE_PAGE;
    }
}

export async function fetchMessages(guildId: string | null, channelId: string, direction: PageDirection, messageId: string | null = null, limit: number = 50): Promise<MessagePage> {
    if (channelId === null) {
        console.error("api - fetchMessageIds - channelId is null")
        return EMPTY_MESSAGE_PAGE;
    }
    const [cursorKey, cursor] = getCursorParameter(direction, messageId);
    return fetchPage("/api/guild/messages", {
        guild_id: normalizeGuildId(guildId),
        channel_id: channelId,
        [cursorKey]: cursor,
        limit,
    }, "api - Failed to fetch messages");
}

export async function fetchSearch(guildId: string | null, prompt: string, direction: PageDirection, messageId: string | null = null, limit: number = 50): Promise<MessagePage> {
    const [cursorKey, cursor] = getCursorParameter(direction, messageId);
    return fetchPage("/api/guild/search", {
        guild_id: normalizeGuildId(guildId),
        prompt,
        [cursorKey]: cursor,
        limit,
    }, "api - Failed to fetch search");
}

export async function fetchPinnedMessages(guildId: string | null, channelId: string, direction: PageDirection, messageId: string | null = null, limit: number = 50): Promise<MessagePage> {
    const prompt = `pinned:true in_id:${channelId}`
    return fetchSearch(guildId, prompt, direction, messageId, limit)
}

export async function fetchSearchCount(guildId: string | null, prompt: string): Promise<number | string> {
    // delay a bit to make sure (faster) search query runs first
    await new Promise(r => setTimeout(r, 25));

    try {
        const params = new URLSearchParams({
            guild_id: normalizeGuildId(guildId),
            prompt,
        });
        const response = await fetch(`/api/guild/search/count?${params}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const count = Number(await response.text());
        return Number.isFinite(count) ? count : "error";
    }
    catch (error) {
        console.error("api - Failed to fetch search count", error)
        return "error"
    }
}

export async function fetchAutocomplete(guildId: string | null, key: string, value: string, limit: number = 3) {
    try {
        const params = new URLSearchParams({
            guild_id: normalizeGuildId(guildId),
            key,
            value,
            limit: String(limit),
        });
        const response = await fetch(`/api/guild/search/autocomplete?${params}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("api - Failed to fetch autocomplete", error)
        return []
    }
}



export async function fetchGuilds() {
    try {
        const response = await fetch('/api/guilds')
        const guilds = await response.json()
        return guilds
        // guilds.set(response_json)
    }
    catch (e) {
        console.error("api - Failed to fetch guilds", e)
    }
    return []
}


export async function fetchCategoriesChannelsThreads(guildId: string | null): Promise<Category[]> {
    guildId = normalizeGuildId(guildId);
    try {
        const params = new URLSearchParams({ guild_id: guildId });
        const response = await fetch(`/api/guild/channels?${params}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const channels: Channel[] = await response.json();
        const isThread = (channel: Channel) =>
            channel.type === "GuildPublicThread" || channel.type === "GuildPrivateThread";
        const channelsWithThreads: ChannelWithThreads[] = channels
            .filter(channel => !isThread(channel))
            .map(channel => ({
                ...channel,
                categoryId: guildId === DEFAULT_GUILD_ID ? "0" : channel.categoryId,
                threads: [],
            }));
        const categories: Category[] = guildId === DEFAULT_GUILD_ID
            ? [{ _id: "0", name: "Direct Messages", channels: [], msg_count: 0 }]
            : [];

        for (const channel of channelsWithThreads) {
            let category = categories.find(item => item._id === channel.categoryId);
            if (!category) {
                category = {
                    _id: channel.categoryId,
                    name: channel.category,
                    channels: [],
                    msg_count: 0,
                };
                categories.push(category);
            }
            category.channels.push(channel);
            category.msg_count += channel.msg_count;
        }

        const lostThreads: Channel[] = [];
        for (const thread of channels.filter(isThread)) {
            const parent = channelsWithThreads.find(channel => channel._id === thread.categoryId);
            if (parent) {
                parent.threads.push(thread);
                parent.msg_count += thread.msg_count;
                const category = categories.find(item => item._id === parent.categoryId);
                if (category) category.msg_count += thread.msg_count;
            } else {
                lostThreads.push(thread);
            }
        }

        if (lostThreads.length > 0) {
            const msgCount = lostThreads.reduce((total, thread) => total + thread.msg_count, 0);
            categories.push({
                _id: "lost-threads",
                name: "Lost threads / forums",
                msg_count: msgCount,
                channels: [{
                    _id: "lost-threads",
                    type: "GuildTextChat",
                    categoryId: "lost-threads",
                    category: "Lost threads / forums",
                    name: "Lost threads / forums",
                    topic: null,
                    threads: lostThreads,
                    msg_count: msgCount,
                    guildId,
                }],
            });
        }

        for (const category of categories) {
            category.channels.sort((a, b) => b.msg_count - a.msg_count);
            for (const channel of category.channels) {
                channel.threads.sort((a, b) => b.msg_count - a.msg_count);
            }
        }
        return categories.sort((a, b) => b.msg_count - a.msg_count);
    } catch (error) {
        console.error("api - Failed to fetch channels", error)
    }
    return []
}
