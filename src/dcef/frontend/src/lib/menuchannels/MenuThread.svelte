<script lang="ts">
    import { copyTextToClipboard } from "../../js/helpers";
    import type { Channel } from "../../js/interfaces";
    import { getGuildState } from "../../js/stores/guildState.svelte";
    import { contextMenuItems } from "../../js/stores/menuStore";
    import { linkHandler, channelScrollPosition } from "../../js/stores/settingsStore.svelte";
    import { getLayoutState } from "../../js/stores/layoutState.svelte";
    import { getBookmarksStore, markChannelCompleted, unmarkChannelCompleted } from "../../js/stores/bookmarkStore.svelte";


    interface MyProps {
        thread: Channel;
        parentChannelId: string;
        isLast: boolean;
    }
    let { thread, parentChannelId, isLast }: MyProps = $props();

    const bookmarkStore = getBookmarksStore();
    const checkpoint = $derived(bookmarkStore.getCheckpoint(thread.guildId, thread._id));
    const readCount = $derived(checkpoint?.read_count ?? 0);
    const totalCount = $derived(checkpoint?.total_count ?? 0);
    const progressPercent = $derived(totalCount > 0 ? Math.round((readCount / totalCount) * 100) : null);
    const isCompleted = $derived(bookmarkStore.isCompleted(thread.guildId, thread._id) || (progressPercent !== null && progressPercent === 100));


    function onThreadRightClick(e, id: string, name: string) {
		$contextMenuItems = [
            {
                "name": isCompleted ? "✖ 読了完了マークを解除" : "✔ 読了完了としてマーク",
                "action": async () => {
                    if (isCompleted) {
                        await unmarkChannelCompleted(thread.guildId, thread._id);
                    } else {
                        await markChannelCompleted(thread.guildId, thread._id);
                    }
                }
            },
            {
				"name": `Open thread in discord ${$linkHandler === 'app' ? "app" : "web"}`,
				"action": () => {
					window.open(($linkHandler === "app" ? "discord://" : "") + `https://discord.com/channels/${BigInt(guildState.guildId)}/${BigInt(id)}`,'_blank')
				}
			},
			{
				"name": "Copy thread ID",
				"action": () => {
					copyTextToClipboard(BigInt(id))
				}
			},
			{
				"name": "Copy thread name",
				"action": () => {
					copyTextToClipboard(name)
				}
			}
		]
	}

    async function changeThread(guildId: string, channelId: string, threadId: string) {
        await guildState.changeGuildId(guildId)
        let changed = false
        if (guildState.channelId !== channelId) {
            await guildState.changeChannelId(channelId, $channelScrollPosition)
            changed = true
        }
        if (guildState.threadId !== threadId) {
            await guildState.changeThreadId(threadId, $channelScrollPosition)
            changed = true
        }
        if (changed) {
            if (layoutState.mobile) {
                layoutState.hideSidePanel()
            }
        }
        await guildState.pushState()
    }

    const guildState = getGuildState()
    const layoutState = getLayoutState()
</script>

<div class="thread" class:selected={thread._id == guildState.threadId} on:click={()=>changeThread(thread.guildId, parentChannelId, thread._id)} on:contextmenu|preventDefault={(e) => onThreadRightClick(e, thread._id, thread.name)}>
    <div class="thread-icon">
        {#if isLast}
            <svg class="up" width="12" height="11" viewBox="0 0 12 11" fill="none" aria-hidden="true">
                <path d="M11 9H4C2.89543 9 2 8.10457 2 7V1C2 0.447715 1.55228 0 1 0C0.447715 0 0 0.447715 0 1V7C0 9.20914 1.79086 11 4 11H11C11.5523 11 12 10.5523 12 10C12 9.44771 11.5523 9 11 9Z" fill="currentColor"></path>
            </svg>
        {:else}
            <div class="border"></div>
            <svg class="up" width="12" height="11" viewBox="0 0 12 11" fill="none" aria-hidden="true">
                <path d="M11 9H4C2.89543 9 2 8.10457 2 7V1C2 0.447715 1.55228 0 1 0C0.447715 0 0 0.447715 0 1V7C0 9.20914 1.79086 11 4 11H11C11.5523 11 12 10.5523 12 10C12 9.44771 11.5523 9 11 9Z" fill="currentColor"></path>
            </svg>
            <svg class="down" width="12" height="11" viewBox="0 0 12 11" fill="none" aria-hidden="true" style="transform: rotateX(180deg) translateY(-9px);">
                <path d="M11 9H4C2.89543 9 2 8.10457 2 7V1C2 0.447715 1.55228 0 1 0C0.447715 0 0 0.447715 0 1V7C0 9.20914 1.79086 11 4 11H11C11.5523 11 12 10.5523 12 10C12 9.44771 11.5523 9 11 9Z" fill="currentColor"></path>
            </svg>
        {/if}
    </div>
    <div class="thread-name-container">
        <div class="thread-name" title="{thread.msg_count} messages">{thread.name}</div>
        {#if progressPercent !== null}
            <span class="progress-badge" class:completed={isCompleted} title="{readCount} / {totalCount} messages read ({progressPercent}%)">
                {#if isCompleted}
                    <svg class="check-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                {:else}
                    {progressPercent}%
                {/if}
            </span>
        {:else if isCompleted}
            <span class="progress-badge completed" title="読了完了">
                <svg class="check-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </span>
        {/if}
    </div>
</div>


<style>
    .thread {
        display: flex;
        height: 34px;
        margin: 0px 15px 0px 30px;

        align-items: center;
        text-decoration: none;
        cursor: pointer;
    }
    .thread:hover {
        color: white;
    }

    .thread-icon {
        color: #4E5058;
        overflow: visible;
        display: flex;
        flex-direction: column;
        position: relative;
        height: 20px;
    }


    .thread-icon .up {
        margin-top: 1px;
    }
    .thread-icon .down {
        margin-top: -11px;
    }



    .thread-icon .border {
        background: #4E5058;
        border-radius: 2px;
        left: 0px;
        top: 0px;
        position: absolute;
        width: 2px;
        height: 39px;
    }

    .thread-name-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-grow: 1;
        min-width: 0;
        padding-left: 7px;
    }

    .thread-name {
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        color: #949BA4;
        line-height: 20px;
        font-weight: 500;
        font-size: inherit;
        height: 20px;
        overflow: hidden;
        flex-grow: 1;
        min-width: 0;
    }
    .selected .thread-name {
        color: white;
    }

    .progress-badge {
        font-size: 10px;
        font-weight: 700;
        color: #949ba4;
        background-color: rgba(255, 255, 255, 0.06);
        padding: 1px 5px;
        border-radius: 8px;
        margin-left: 6px;
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 16px;
        min-width: 16px;
        box-sizing: border-box;
        transition: all 0.15s ease;
    }
    .progress-badge:hover {
        background-color: rgba(255, 255, 255, 0.12);
        color: #dbdee1;
        transform: scale(1.05);
    }
    .progress-badge.completed {
        color: #ffffff;
        background-color: #23a55a;
    }
    .progress-badge.completed:hover {
        background-color: #24b462;
    }
    
    .check-icon {
        display: inline-block;
    }
</style>