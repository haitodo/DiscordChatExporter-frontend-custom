import type { Asset, Category, Channel, ChannelWithThreads, Guild, MessagePage } from "../interfaces";

export type PageDirection = "before" | "after" | "around" | "first" | "last";

type QueryParams = Record<string, string | number>;

export interface AutocompleteSuggestion {
    key: string;
    description?: string;
    description2?: string;
    icon?: Asset | null;
}

const DEFAULT_GUILD_ID = "000000000000000000000000";
const FIRST_CURSOR = "0";
const LAST_CURSOR = "999999999999999999999999";

function createEmptyMessagePage(): MessagePage {
    return {
        prevPage: null,
        messageIds: [],
        nextPage: null,
        messages: [],
    };
}

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

function buildUrl(endpoint: string, params: QueryParams): string {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== null && value !== undefined && value !== "") {
            query.set(key, String(value));
        }
    }
    const queryString = query.toString();
    return queryString ? `${endpoint}?${queryString}` : endpoint;
}

async function request<T>(
    endpoint: string,
    params: QueryParams,
    errorMessage: string,
    readResponse: (response: Response) => Promise<T>,
): Promise<T | null> {
    try {
        const response = await fetch(buildUrl(endpoint, params));
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return await readResponse(response);
    } catch (error) {
        console.error(errorMessage, error);
        return null;
    }
}

function requestJson<T>(
    endpoint: string,
    params: QueryParams,
    errorMessage: string,
): Promise<T | null> {
    return request(endpoint, params, errorMessage, response => response.json() as Promise<T>);
}

function requestText(
    endpoint: string,
    params: QueryParams,
    errorMessage: string,
): Promise<string | null> {
    return request(endpoint, params, errorMessage, response => response.text());
}

export async function fetchMessages(
    guildId: string | null,
    channelId: string | null,
    direction: PageDirection,
    messageId: string | null = null,
    limit: number = 50,
): Promise<MessagePage> {
    if (channelId === null) {
        console.error("api - fetchMessages - channelId is null");
        return createEmptyMessagePage();
    }

    const [cursorKey, cursor] = getCursorParameter(direction, messageId);
    return await requestJson<MessagePage>("/api/guild/messages", {
        guild_id: normalizeGuildId(guildId),
        channel_id: channelId,
        [cursorKey]: cursor,
        limit,
    }, "api - Failed to fetch messages") ?? createEmptyMessagePage();
}

export async function fetchSearch(
    guildId: string | null,
    prompt: string,
    direction: PageDirection,
    messageId: string | null = null,
    limit: number = 50,
): Promise<MessagePage> {
    const [cursorKey, cursor] = getCursorParameter(direction, messageId);
    return await requestJson<MessagePage>("/api/guild/search", {
        guild_id: normalizeGuildId(guildId),
        prompt,
        [cursorKey]: cursor,
        limit,
    }, "api - Failed to fetch search") ?? createEmptyMessagePage();
}

export async function fetchPinnedMessages(
    guildId: string | null,
    channelId: string,
    direction: PageDirection,
    messageId: string | null = null,
    limit: number = 50,
): Promise<MessagePage> {
    return fetchSearch(guildId, `pinned:true in_id:${channelId}`, direction, messageId, limit);
}

export async function fetchSearchCount(guildId: string | null, prompt: string): Promise<number | string> {
    // Delay a bit to make sure the faster search query runs first.
    await new Promise(resolve => setTimeout(resolve, 25));

    const countText = await requestText("/api/guild/search/count", {
        guild_id: normalizeGuildId(guildId),
        prompt,
    }, "api - Failed to fetch search count");
    const count = countText === null ? NaN : Number(countText);
    return Number.isFinite(count) ? count : "error";
}

export async function fetchAutocomplete(
    guildId: string | null,
    key: string,
    value: string,
    limit: number = 3,
): Promise<AutocompleteSuggestion[]> {
    return await requestJson<AutocompleteSuggestion[]>("/api/guild/search/autocomplete", {
        guild_id: normalizeGuildId(guildId),
        key,
        value,
        limit,
    }, "api - Failed to fetch autocomplete") ?? [];
}

export async function fetchGuilds(): Promise<Guild[]> {
    return await requestJson<Guild[]>("/api/guilds", {}, "api - Failed to fetch guilds") ?? [];
}

function isThread(channel: Channel): boolean {
    return channel.type === "GuildPublicThread" || channel.type === "GuildPrivateThread";
}

/** Builds the menu hierarchy from the flat channel response returned by the API. */
export function groupChannelsIntoCategories(channels: Channel[], guildId: string): Category[] {
    const isDirectMessages = guildId === DEFAULT_GUILD_ID;
    const categories: Category[] = isDirectMessages
        ? [{ _id: "0", name: "Direct Messages", channels: [], msg_count: 0 }]
        : [];
    const categoryById = new Map(categories.map(category => [category._id, category]));
    const channelById = new Map<string, ChannelWithThreads>();
    const threads: Channel[] = [];

    // Single-pass classification of channels and threads
    for (const channel of channels) {
        if (isThread(channel)) {
            threads.push(channel);
        } else {
            const categoryId = isDirectMessages ? "0" : channel.categoryId;
            const channelWithThreads: ChannelWithThreads = {
                ...channel,
                categoryId,
                threads: [],
            };
            channelById.set(channel._id, channelWithThreads);

            let category = categoryById.get(categoryId);
            if (!category) {
                category = {
                    _id: categoryId,
                    name: channel.category,
                    channels: [],
                    msg_count: 0,
                };
                categories.push(category);
                categoryById.set(categoryId, category);
            }
            category.channels.push(channelWithThreads);
            category.msg_count += channel.msg_count;
        }
    }

    const lostThreads: Channel[] = [];
    for (const thread of threads) {
        const parent = channelById.get(thread.categoryId);
        if (!parent) {
            lostThreads.push(thread);
            continue;
        }

        parent.threads.push(thread);
        parent.msg_count += thread.msg_count;
        const category = categoryById.get(parent.categoryId);
        if (category) category.msg_count += thread.msg_count;
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
}

export async function fetchCategoriesChannelsThreads(guildId: string | null): Promise<Category[]> {
    const normalizedGuildId = normalizeGuildId(guildId);
    const channels = await requestJson<Channel[]>(
        "/api/guild/channels",
        { guild_id: normalizedGuildId },
        "api - Failed to fetch channels",
    );
    return channels ? groupChannelsIntoCategories(channels, normalizedGuildId) : [];
}
