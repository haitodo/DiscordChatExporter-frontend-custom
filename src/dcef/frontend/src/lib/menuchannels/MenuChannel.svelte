<script lang="ts">
    import MenuThread from "./MenuThread.svelte";
    import { copyTextToClipboard } from "../../js/helpers";
    import { contextMenuItems } from "../../js/stores/menuStore";
    import type { Channel } from "../../js/interfaces";
    import { getGuildState } from "../../js/stores/guildState.svelte";
    import { linkHandler, channelScrollPosition } from "../../js/stores/settingsStore.svelte";
    import ChannelIcon from "./ChannelIcon.svelte";
    import { getLayoutState } from "../../js/stores/layoutState.svelte";
    import { getBookmarksStore, markChannelCompleted, unmarkChannelCompleted } from "../../js/stores/bookmarkStore.svelte";


    interface MyProps {
        channel: Channel;
    }
    let { channel }: MyProps = $props();

    let isOpen: boolean = $state(false)
    const guildState = getGuildState()
    const layoutState = getLayoutState()

    const bookmarkStore = getBookmarksStore();
    const checkpoint = $derived(bookmarkStore.getCheckpoint(guildState.guildId ? guildState.guildId : "000000000000000000000000", channel._id));
    const readCount = $derived(checkpoint?.read_count ?? 0);
    const totalCount = $derived(checkpoint?.total_count ?? 0);
    const progressPercent = $derived(totalCount > 0 ? Math.round((readCount / totalCount) * 100) : null);
    const isCompleted = $derived(bookmarkStore.isCompleted(guildState.guildId ? guildState.guildId : "000000000000000000000000", channel._id) || (progressPercent !== null && progressPercent === 100));


    async function toggle() {
        isOpen = !isOpen
        if (isOpen) {
            if (guildState.channelId !== channel._id) {
                await guildState.changeChannelId(channel._id, $channelScrollPosition)
                if (layoutState.mobile) {
                    layoutState.hideSidePanel()
                }
            }
            await guildState.pushState()
        }
    }

    $effect(() => {
        if (guildState.channelId !== channel._id) {
            isOpen = false
        }
        if (guildState.channelId === channel._id) {
            isOpen = true
        }
    })

    function onChannelRightClick(e, id: string, name: string) {
		$contextMenuItems = [
            {
                "name": isCompleted ? "✖ 読了完了マークを解除" : "✔ 読了完了としてマーク",
                "action": async () => {
                    const gId = guildState.guildId ? guildState.guildId : "000000000000000000000000";
                    if (isCompleted) {
                        await unmarkChannelCompleted(gId, channel._id);
                    } else {
                        await markChannelCompleted(gId, channel._id);
                    }
                }
            },
            {
				"name": `Open channel in discord ${$linkHandler === 'app' ? "app" : "web"}`,
				"action": () => {
					window.open(($linkHandler === "app" ? "discord://" : "") + `https://discord.com/channels/${BigInt(guildState.guildId)}/${BigInt(id)}`,'_blank')
				}
			},
			{
				"name": "Copy channel ID",
				"action": () => {
					copyTextToClipboard(BigInt(id))
				}
			},
			{
				"name": "Copy channel name",
				"action": () => {
					copyTextToClipboard(name)
				}
			}
		]
	}
</script>

<div class="channel" class:selected={guildState.channelId == channel._id} on:click={toggle} on:contextmenu|preventDefault={(e) => onChannelRightClick(e, channel._id, channel.name)}>
    <div class="channel-icon">
        <ChannelIcon channel={channel} width={20} />
    </div>
    <div class="channel-name-container">
        <span class="channel-name" title="{channel.msg_count} messages">{channel.name}</span>
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
{#each channel.threads as thread}
    {#if isOpen || thread._id == guildState.threadId}
        <MenuThread parentChannelId={channel._id} thread={thread} isLast={!isOpen || thread === channel.threads[channel.threads.length - 1]} />
    {/if}
{/each}

<style>
	.channel {
		display: flex;
		align-items: center;
		border-radius: 4px;
		width: calc(100% - 40x);
		padding: 4px 6px;
		margin: 1px 8px;
        gap: 5px;
        color: #949BA4;
        cursor: pointer;
        font-weight: 500;
	}

	.channel:hover,
	.channel.selected {
		background-color: #404249;
		color: white;
	}

	.channel-icon {
		width: 24px;
		margin-right: 5px;
	}

	.channel-name-container {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-grow: 1;
		min-width: 0;
	}

	.channel-name {
		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
		flex-grow: 1;
		min-width: 0;
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
	.channel:hover .progress-badge {
		background-color: rgba(255, 255, 255, 0.12);
		color: #dbdee1;
	}
	.progress-badge:hover {
		transform: scale(1.05);
	}
	.progress-badge.completed {
		color: #ffffff;
		background-color: #23a55a;
	}
	.channel:hover .progress-badge.completed {
		background-color: #24b462;
	}
	
	.check-icon {
		display: inline-block;
	}
</style>