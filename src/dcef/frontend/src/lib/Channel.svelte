<script lang="ts">
    import { isDateDifferent } from "../js/helpers";
    import { fetchMessages } from "../js/stores/api";
    import { getGuildState } from "../js/stores/guildState.svelte";
    import { getLayoutState } from "../js/stores/layoutState.svelte";
    import DateSeparator from "./DateSeparator.svelte";
    import InfiniteScroll3 from "./InfiniteScroll3.svelte";
    import ChannelStart from "./message/ChannelStart.svelte";
    import Message from "./message/Message.svelte";
    import { getBookmarksStore } from "../js/stores/bookmarkStore.svelte";
    import Icon from "./icons/Icon.svelte";

    const guildState = getGuildState()
    const layoutState = getLayoutState()
    const bookmarkStore = getBookmarksStore();

    let apiGuildId = $derived(guildState.guildId ? guildState.guildId : "000000000000000000000000")
    let apiChannelId = $derived(guildState.channelId)


    async function fetchMessagesWrapper(direction: "before" | "after" | "around" | "first" | "last", messageId: string | null = null, limit: number) {
        return fetchMessages(apiGuildId, apiChannelId, direction, messageId, limit)
    }
</script>

{#snippet channelStartSnippet(message)}
    <ChannelStart channelName={message.channelName} isThread={false} messageAuthor={message.author} />
{/snippet}

{#snippet channelEndSnippet(index, message, previousMessage)}
    <div data-messageid="last" class="channel-boundary">
        this is the end of the channel
    </div>
{/snippet}

{#snippet renderMessageSnippet2(message, previousMessage)}
    <div data-messageid={message._id}>
        {#if message._id === "first"}
            <div class="channel-boundary">channel start</div>
        {:else if message._id === "last"}
            <div class="channel-boundary">channel end</div>
        {:else}
            {#if isDateDifferent(previousMessage, message)}
                <DateSeparator messageId={message._id} />
            {/if}
            {#if bookmarkStore.getCheckpoint(apiGuildId, apiChannelId)?.message_id === message._id}
                <div class="checkpoint-separator">
                    <span class="checkpoint-line"></span>
                    <span class="checkpoint-tag">
                        <Icon name="other/bookmark-filled" width={12} inline={true} />
                        前回ここまで読みました
                    </span>
                    <span class="checkpoint-line"></span>
                </div>
            {/if}
            <Message message={message} previousMessage={previousMessage} />
        {/if}
    </div>
{/snippet}

<div class="channel-wrapper" class:threadshown={layoutState.threadshown}>
    <div class="channel" >
        {#if apiChannelId}
            <!-- TODO: support change of selectedMessageId without rerender -->
            {#key guildState.channelMessageId}
                {#key apiChannelId}
                    <InfiniteScroll3
                        fetchMessages={fetchMessagesWrapper}
                        scrollToMessageId={guildState.channelMessageId}
                        snippetMessage={renderMessageSnippet2}
                        channelStartSnippet={channelStartSnippet}
                        channelOrThreadId={apiChannelId}
                    />
                {/key}
            {/key}
        {/if}
    </div>
</div>


<style>
    .channel-wrapper {
        height: 100%;
        overflow: hidden;
    }

    .channel-boundary {
        text-align: center;
        color: #80848e;
        padding: 20px 0;
        font-size: 14px;
        font-weight: 500;
        user-select: none;
    }

    .threadshown {
        border-bottom-right-radius: 8px;
    }
    .channel {
        background-color: #313338;
        height: 100%;
    }

    .checkpoint-separator {
        display: flex;
        align-items: center;
        margin: 16px 20px 8px 20px;
        color: #23a55a;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        user-select: none;
    }
    .checkpoint-line {
        flex: 1;
        height: 1px;
        background-color: #23a55a;
        opacity: 0.6;
    }
    .checkpoint-tag {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0 8px;
    }
</style>