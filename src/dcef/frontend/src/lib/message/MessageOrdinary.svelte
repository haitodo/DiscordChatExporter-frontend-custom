<script lang="ts">
    import type { Message } from "../../js/interfaces";
    import { getViewUserState } from "../viewuser/viewUserState.svelte";
    import MessageAttachments from "./MessageAttachments.svelte";
    import MessageAuthorName from "./MessageAuthorName.svelte";
    import MessageAvatar from "./MessageAvatar.svelte";
    import MessageContent from "./MessageContent.svelte";
    import MessageEmbed from "./MessageEmbed.svelte";
    import MessageInvite from "./MessageInvite.svelte";
    import MessageReactions from "./MessageReactions.svelte";
    import MessageReferenced from "./MessageReferenced.svelte";
    import MessageStickers from "./MessageStickers.svelte";
    import MessageTimestamp from "./MessageTimestamp.svelte";
    import { onMessageRightClick } from "./messageRightClick";
    import { findThread, getGuildState } from "../../js/stores/guildState.svelte";
    import Icon from "../icons/Icon.svelte";

    export let message: Message;
    export let messageState;
    const viewUserState = getViewUserState()
    const guildState = getGuildState()

    $: thread = findThread(message._id)

    async function jumpToThread() {
        if (thread) {
            await guildState.changeThreadId(thread._id, null)
            await guildState.pushState()
        }
    }

</script>
<MessageReferenced message={message} referencedMessage={message?.reference?.message} messageState={messageState} />
<div class="avatar-row">
    {#if !messageState.shouldMerge}
        <MessageAvatar author={message.author} on:click={() => viewUserState.setUser(message.author)} messageState={messageState} />
    {:else}
        <div></div>
    {/if}
    <div on:click style="width: 100%;">
        {#if !messageState.shouldMerge}
            <div class="authorline"><MessageAuthorName author={message.author} on:click={() => viewUserState.setUser(message.author)} messageState={messageState} /> <MessageTimestamp channelOrThreadId={message.channelId} timestamp={message.timestamp} messageId={message._id} /></div>
        {/if}
        <div class="message-accessories" on:contextmenu|preventDefault={e=>onMessageRightClick(e, message)}>
            {#if !messageState.messageContentIsLink || !message.content[0].content.includes("https://tenor.com/view/")}
                <div><MessageContent message={message} /></div>
            {/if}
            {#each messageState.inviteIds as inviteId}
                <MessageInvite inviteId={inviteId} />
            {/each}
            {#if message.embeds}
                {#each message.embeds as embed}
                    <div><MessageEmbed embed={embed} messageState={messageState} /></div>
                {/each}
            {/if}
            {#if message.attachments}
                <div><MessageAttachments attachments={message.attachments} /></div>
            {/if}
            {#if message.stickers}
                <MessageStickers stickers={message.stickers} />
            {/if}
            <!-- {/if} -->
        </div>
        {#if thread}
            <div class="thread-indicator" on:click={jumpToThread}>
                <div class="thread-icon"><Icon name="channeltype/thread" width={16} /></div>
                <div class="thread-name" title="{thread.msg_count} messages">{thread.name}</div>
                <div class="thread-msg-count">{thread.msg_count} messages</div>
                <div class="thread-jump-btn">
                    <span>See Thread</span>
                    <div style="transform: rotate(90deg); display: grid; place-items: center;">
                        <Icon name="modal/arrowUp" width={14} />
                    </div>
                </div>
            </div>
        {/if}
        {#if message.reactions}
            <MessageReactions reactions={message.reactions} />
        {/if}
    </div>
</div>

<style>

    .authorline {
        margin-bottom: 2px;
    }
    .avatar-row {
        display: grid;
        gap: 15px;
        grid-template-columns: 40px 1fr;
        width: 100%;
    }

    .message-accessories {
        width: 100%;
        display:flex;
        flex-direction:column;
        gap:4px;
    }

    .thread-indicator {
        margin-top: 8px;
        margin-bottom: 4px;
        background-color: #2b2d31;
        border-radius: 4px;
        padding: 8px 12px;
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        width: fit-content;
        max-width: 100%;
        border: 1px solid rgba(0,0,0,0);

        &:hover {
            background-color: #35373c;
            border: 1px solid #1e1f22;
        }

        .thread-icon {
            color: #b5bac1;
        }

        .thread-name {
            color: white;
            font-weight: 600;
            font-size: 14px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .thread-msg-count {
            color: #b5bac1;
            font-size: 14px;
            white-space: nowrap;
        }

        .thread-jump-btn {
            margin-left: 8px;
            display: flex;
            align-items: center;
            gap: 4px;
            color: #00a8fc;
            font-size: 14px;
            font-weight: 500;
        }
        &:hover .thread-jump-btn {
            color: #00b8ff;
        }
    }

</style>