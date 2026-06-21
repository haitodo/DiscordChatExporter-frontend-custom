import { get } from "svelte/store"
import { checkUrl, copyTextToClipboard } from "../../js/helpers"
import type { Author, Message } from "../../js/interfaces"
import { contextMenuItems } from "../../js/stores/menuStore"
import { linkHandler, setCurrentUser } from "../../js/stores/settingsStore.svelte"
import { getBookmarksStore, addBookmark, deleteBookmark, setCheckpoint } from "../../js/stores/bookmarkStore.svelte"


export function onUserRightClick(e, author: Author) {
    contextMenuItems.set([
        {
            "name": "View discord as this user",
            "action": () => {
                setCurrentUser(author._id, author.nickname, author.name, checkUrl(author.avatar))
            }
        },
        {
            "name": "Copy user ID",
            "action": () => {
                copyTextToClipboard(BigInt(author._id))
            }
        }
    ])
}


export function onMessageRightClick(e, message: Message) {
    const bookmarkStore = getBookmarksStore();
    const isBookmarked = bookmarkStore.isBookmarked(message.guildId, message._id);

    contextMenuItems.set([
        {
            "name": isBookmarked ? "★ お気に入りから削除" : "☆ お気に入りに追加",
            "action": async () => {
                if (isBookmarked) {
                    await deleteBookmark(message.guildId, message._id);
                } else {
                    await addBookmark(message);
                }
            }
        },
        {
            "name": "✔ ここまで読んだ (チェックポイント)",
            "action": async () => {
                await setCheckpoint(message.guildId, message.channelId, message._id, message.timestamp);
            }
        },
        {
            "name": `Open message in discord ${get(linkHandler) === 'app' ? "app" : "web"}`,
            "action": () => {
                window.open((get(linkHandler) === "app" ? "discord://" : "") + `https://discord.com/channels/${BigInt(message.guildId)}/${BigInt(message.channelId)}/${BigInt(message._id)}`,'_blank')
            }
        },
        {
            "name": "Copy text",
            "action": () => {
                copyTextToClipboard(message.content[0].content);
            }
        },
        {
            "name": "Copy message link",
            "action": () => {
                copyTextToClipboard(`https://discord.com/channels/${BigInt(message.guildId)}/${BigInt(message.channelId)}/${BigInt(message._id)}`);
            }
        },
        {
            "name": "Copy message ID",
            "action": () => {
                copyTextToClipboard(BigInt(message._id))
            }
        },
        {
            "name": "Print message object to devtools (F12)",
            "action": () => {
                console.log(JSON.stringify(message, null, 2))
            }
        }
    ])
}