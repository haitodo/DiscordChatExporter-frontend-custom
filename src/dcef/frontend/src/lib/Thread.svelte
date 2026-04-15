<script lang="ts">
    import { isDateDifferent } from "../js/helpers";
    import { fetchMessages } from "../js/stores/api";
    import { getGuildState } from "../js/stores/guildState.svelte";
    import { getLayoutState } from "../js/stores/layoutState.svelte";
    import DateSeparator from "./DateSeparator.svelte";
    import InfiniteScroll3 from "./InfiniteScroll3.svelte";
    import Pinned from "./Pinned.svelte";
    import Icon from "./icons/Icon.svelte";
    import ChannelIcon from "./menuchannels/ChannelIcon.svelte";
    import ChannelStart from "./message/ChannelStart.svelte";
    import Message from "./message/Message.svelte";

    function destroyThreadView() {
        guildState.changeThreadId(null)
        guildState.pushState()
    }

    const guildState = getGuildState()
    const layoutState = getLayoutState()

    let apiGuildId = $derived(guildState.guildId ? guildState.guildId : "000000000000000000000000")
    let apiThreadId = $derived(guildState.threadId)

    export async function fetchMessagesWrapper(direction: "before" | "after" | "around" | "first" | "last", messageId: string | null = null, limit: number) {
        return fetchMessages(apiGuildId, apiThreadId, direction, messageId, limit)
    }
</script>

{#snippet channelStartSnippet(message)}
    <ChannelStart channelName={message.channelName} isThread={true} messageAuthor={message.author} />
{/snippet}

{#snippet renderMessageSnippet2(message, previousMessage)}
    <div data-messageid={message._id}>
        {#if message._id === "first"}
            <div class="channel-boundary">thread start</div>
        {:else if message._id === "last"}
            <div class="channel-boundary">thread end</div>
        {:else}
            {#if isDateDifferent(previousMessage, message)}
                <DateSeparator messageId={message._id} />
            {/if}
            <Message message={message} previousMessage={previousMessage} />
        {/if}
    </div>
{/snippet}


<div class="thread-wrapper">
    <div class="header-main">
        <div class="thread-name">
            {#if layoutState.mobile}
                <button class="hamburger-icon" onclick={layoutState.toggleSidePanel}>
                    <Icon name="other/hamburger" width={20} />
                </button>
            {/if}
            {#if guildState.thread?.name}
                <ChannelIcon channel={guildState.thread} width={20} /><span>{guildState.thread.name}</span>
            {:else}
                <span>Select a thread</span>
            {/if}
        </div>
        <div class="pin-wrapper">
            <div class="jump-buttons">
                <div class="jump-btn" title="Jump to top" onclick={() => guildState.changeThreadId(guildState.threadId, "first")}>
                    <Icon name="modal/arrowUp" width={24} />
                </div>
                <div class="jump-btn" title="Jump to bottom" onclick={() => guildState.changeThreadId(guildState.threadId, "last")}>
                    <div style="transform: rotate(180deg); display: grid; place-items: center;">
                        <Icon name="modal/arrowUp" width={24} />
                    </div>
                </div>
            </div>
            <div class="pin-btn" class:active={layoutState.threadpinnedshown} onclick={layoutState.toggleThreadPinned}>
                <Icon name="systemmessage/pinned" width={24} />
            </div>
            {#if layoutState.threadpinnedshown}
                <div class="pin-messages">
                    {#key guildState.threadMessageId}
                        <Pinned channelId={guildState.threadId} />
                    {/key}
                </div>
            {/if}
        </div>
        <div onclick={destroyThreadView} style="cursor:pointer; display: grid; place-items: center;">
            <Icon name="modal/x" width={24} />
        </div>
    </div>
    <div class="thread">
        <!-- TODO: support change of threadMessageId without rerender -->
        {#if apiThreadId}
            {#key apiThreadId}
                {#key guildState.threadMessageId}
                    <InfiniteScroll3
                        fetchMessages={fetchMessagesWrapper}
                        scrollToMessageId={guildState.threadMessageId}
                        snippetMessage={renderMessageSnippet2}
                        channelStartSnippet={channelStartSnippet}
                    />
                {/key}
            {/key}
        {/if}
    </div>
</div>


<style>
    .hamburger-icon {
        cursor: pointer;
        color: #b5bac1;
        margin-right: 10px;
        &:hover {
            color: #dbdee1;
        }
    }

    .pin-wrapper {
        position: relative;
        display: flex;
        align-items: center;
        gap: 15px;

        .jump-buttons {
            display: flex;
            gap: 10px;
        }
        .jump-btn {
            cursor: pointer;
            color: #b5bac1;
            padding: 4px;
            border-radius: 4px;
            transition: background-color 0.15s ease, color 0.15s ease;
            &:hover {
                color: #dbdee1;
                background-color: rgba(79, 84, 92, 0.32);
            }
        }
        .pin-btn {
            cursor: pointer;
            color: #b5bac1;
            padding: 4px;
            border-radius: 4px;
            transition: background-color 0.15s ease, color 0.15s ease;
            &:hover {
                color: #dbdee1;
                background-color: rgba(79, 84, 92, 0.32);
            }
            &.active {
                color: white;
            }
        }
        .pin-messages {
            position: absolute;
            top: 30px;
            right: 0px;

            width: 400px;
            z-index: 500;
        }
    }

    .thread-wrapper {
        height: 100%;
        margin-left: 7px;
        background-color: #313338;
        display: flex;
        flex-direction: column;

        border-top-left-radius: 8px;
        border-bottom-left-radius: 8px;
        overflow: hidden;

        z-index: 101;
    }
    .header-main {
        height: 47px;
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 5px 10px 5px 15px;
        box-sizing: border-box;
        gap: 5px;
        border-bottom: 1px solid #20222599;
    }

    .thread-name {
        display: flex;
        gap: 8px;
        font-size: 16px;
        font-weight: 600;
        color: #F2F3F5;
        flex-grow: 3;
    }

    .channel-boundary {
        text-align: center;
        color: #80848e;
        padding: 20px 0;
        font-size: 14px;
        font-weight: 500;
        user-select: none;
    }

    .thread {
        overflow-y: auto;
        height: 100%;
    }


</style>