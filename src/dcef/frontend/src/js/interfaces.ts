export interface Guild {
	_id: string;
	name: string;
	icon: Asset;
	msg_count: number;
}

export interface Category {
	_id: string;
	name: string;
	channels: ChannelWithThreads[];
	msg_count: number;
}

export interface Asset {
	_id: string;
	originalPath: string;
	localPath: string;
	remotePath: string;
	path: string;
	extension: string;
	type: "image" | "video" | "audio" | "unknown";
	width: number;
	height: number;
	sizeBytes: number;
	filenameWithHash: string;
	filenameWithoutHash: string;
	colorDominant: null | [number, number, number];
	colorPalette: null | [number, number, number][];
}

export interface Channel {
	_id: string;
	type: "GuildTextChat" | "DirectTextChat" | "GuildVoiceChat" | "DirectGroupTextChat" | "GuildCategory" | "GuildNews" | "GuildNewsThread" | "GuildPublicThread" | "GuildPrivateThread" | "GuildStageVoice" | "GuildDirectory" | "GuildForum";
	categoryId: string;
	category: string;
	name: string;
	topic: string | null;
	guildId: string;
	msg_count: number;
}

/** A channel after thread relationships have been assembled for the menu. */
export interface ChannelWithThreads extends Channel {
	threads: Channel[];
}

export interface Role {
	_id: string;
	name: string;
	color: null | string;
	position: number;
}

export interface Author {
	name: string;
	nickname: string;
	color: string;
	isBot: boolean;
	avatar: Asset;
	roles?: Role[];
	_id: string;
}

export interface Sticker {
	name: string;
	format: "Png" | "Apng" | "Lottie";
	_id: string;
	source: Asset;
}

export interface Emoji {
	_id: string;
	name: string;
	isAnimated: boolean;
	image: Asset;
	source: "default" | "custom";
	guildId: string | null;
}

export interface ReactionUser {
	name: string;
	nickname: string;
	isBot: boolean;
	avatar: Asset;
	_id: string;
}

export interface Reaction {
	emoji: Emoji;
	count: number;
	users?: ReactionUser[];
}

export interface Mention {
	name: string;
	discriminator: string;
	nickname: string;
	isBot: boolean;
	_id: string;
}

export interface Embed {
	title: string;
	url: string;
	timestamp: string | null;
	description: string;
	thumbnail: Asset;
	images: Asset[];
	image?: Asset;
	video?: Asset;
	fields: {
		name: string;
		value: string;
		isInline: boolean;
	}[];
	color?: string;
	author?: {
		name: string;
		url: string;
		icon?: Asset;
	};
	footer?: {
		text: string;
		icon: Asset;
	};
}

export interface MessageContent {
	timestamp: string;
	content: string;
}


export interface Message {
	_id: string;
	type: "Default" | "RecipientAdd" | "RecipientRemove" | "Call" | "ChannelNameChange" | "ChannelIconChange" | "ChannelPinnedMessage" | "GuildMemberJoin" | "ThreadCreated" | "Reply" | "24" | "8" | "9" | "10" | "11";
	timestamp: string;
	timestampEdited: string | null;
	callEndedTimestamp: string | null;
	isPinned: boolean;
	content: MessageContent[];
	author: Author;
	stickers: Sticker[] | null;
	reactions: Reaction[] | null;
	emotes: Emoji[] | null;   // emotes in the message
	mentions: Mention[] | null;
	roles?: Role[];
	channels?: Channel[];
	isDeleted?: boolean;
	attachments: Asset[] | null;
	embeds: Embed[] | null;
	reference: {
		messageId: string;
		channelId: string;
		guildId: string;
		message?: Message;
	} | null;
	guildId: string;
	channelId: string;
	channelName: string;
	thread?: Channel;            // if message type is "ThreadCreated"
}

export interface MessageIdLoad {
	_id: string;
	loaded: boolean;
}

export interface MessagePage {
	prevPage: string | null;
	nextPage: string | null;
	messageIds: string[];
	messages: Message[];
}

export interface Bookmark {
	_id: string;
	guild_id: string;
	guild_name: string;
	channel_id: string;
	channel_name: string;
	message_id: string;
	note: string;
	message: Message;
	created_at: string;
}

export interface Checkpoint {
	_id: string;
	guild_id: string;
	guild_name: string;
	channel_id: string;
	channel_name: string;
	message_id: string;
	timestamp: string;
	updated_at: string;
	read_count: number;
	total_count: number;
}

export interface CompletedChannel {
	_id: string;
	guild_id: string;
	guild_name: string;
	channel_id: string;
	channel_name: string;
	completed_at: string;
}
