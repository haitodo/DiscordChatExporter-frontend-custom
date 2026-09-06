/// <reference types="svelte" />
/// <reference types="vite/client" />

declare global {
    interface Window {
        globalSetChannel: (guildId: string, channelId: string) => Promise<void>;
        globalSetMessage: (guildId: string, channelId: string, messageId: string) => Promise<void>;
        globalShowSingleAsset: (asset: import("./js/interfaces").Asset) => void;
    }
}

export {};
