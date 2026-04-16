<script lang="ts">
    import { onMount, onDestroy, tick, type Snippet } from "svelte";
    import {throttle, debounce} from 'lodash-es';
    import { jumpToMessageAnimated } from "../js/stores/settingsStore.svelte";
    import { saveScrollMessageId } from "../js/stores/sessionStore";

    interface MyProps {
        fetchMessages: (direction: "before" | "after" | "around" , messageId: string, limit: number) => Promise<string[]>
        snippetMessage: Snippet
        scrollToMessageId: string
        emptySnippet?: Snippet
        channelStartSnippet?: Snippet
        channelOrThreadId?: string | null
    }

    let { fetchMessages, snippetMessage, scrollToMessageId, emptySnippet, channelStartSnippet, channelOrThreadId = null}: MyProps = $props();

    let SHOWDEBUG = false
    let scrollContainer: HTMLDivElement
    let messages = $state<any[]>([])
    let prevPage = $state<string | null>(null)
    let nextPage = $state<string | null>(null)
    let loadIsThrottled = false
    let scrollDisabled = $state(true)
    let isLoading = $state(true)

    const MSGCOUNT_INITIAL = 50
    const MSGCOUNT_MORE = 25


    let preMessagesMapping = new Map<string, any>()  // id (current) -> message (previous)

    /**
     * ビューポート中央付近のメッセージIDを特定してlocalStorageに保存
     */
    function saveCurrentScrollPosition() {
        if (!channelOrThreadId || !scrollContainer || messages.length === 0) {
            return;
        }
        const containerRect = scrollContainer.getBoundingClientRect();
        const centerY = containerRect.top + containerRect.height / 2;

        // ビューポート中央に最も近いメッセージを探す
        const messageElements = scrollContainer.querySelectorAll('[data-messageid]');
        let closestId: string | null = null;
        let closestDistance = Infinity;

        for (const el of messageElements) {
            const msgId = (el as HTMLElement).dataset.messageid;
            if (!msgId || msgId === 'first' || msgId === 'last') continue;

            const rect = el.getBoundingClientRect();
            const msgCenterY = rect.top + rect.height / 2;
            const distance = Math.abs(msgCenterY - centerY);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestId = msgId;
            }
        }

        if (closestId) {
            saveScrollMessageId(channelOrThreadId, closestId);
        }
    }
    // スクロール位置の保存は500msにthrottle
    const throttledSaveScrollPosition = throttle(saveCurrentScrollPosition, 500, { leading: false, trailing: true });

    async function handleScroll(event: Event) {

        if (loadIsThrottled) {
            debouncedHandleScroll(event)
            event.preventDefault()
            return
        }
        if (scrollDisabled) {
            event.preventDefault()
            return
        }
        // if at the top of scroll container, load more messages before
        if (prevPage && scrollContainer.scrollTop === 0) {
            loadIsThrottled = true
            scrollDisabled = true
            const bottomOffset = scrollContainer.scrollHeight - scrollContainer.clientHeight
            const moreMessagesObj = await fetchMessages("before", prevPage, MSGCOUNT_MORE)
            const moreMessages = moreMessagesObj.messages


            // --- link previous messages ---
            if (messages.length > 0 && moreMessages.length > 0) {
                // link the first message of the last batch to the last message of the previous batch
                preMessagesMapping.set(messages[0]._id, moreMessages[moreMessages.length - 1])
            }
            for (let i = 1; i < moreMessages.length; i++) {
                preMessagesMapping.set(moreMessages[i]._id, moreMessages[i - 1])
            }
            // --- end of previous message linking ---

            messages = [...moreMessages, ...messages]
            prevPage = moreMessagesObj.prevPage
            await tick();  // wait for render

            // restore the same bottom offset
            let newScrollTop = scrollContainer.scrollHeight - scrollContainer.clientHeight - bottomOffset
            scrollContainer.scrollTop = newScrollTop
            scrollDisabled = false
            loadIsThrottled = false
        }
        // if at the bottom of scroll container, load more messages after
        if (nextPage && scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 1) {
            loadIsThrottled = true
            scrollDisabled = true
            const moreMessagesObj = await fetchMessages("after", nextPage, MSGCOUNT_MORE)
            const moreMessages = moreMessagesObj.messages

            // --- link previous messages ---
            if (messages.length > 0 && moreMessages.length > 0) {
                // link the last message of the last batch to the first message of the next batch
                preMessagesMapping.set(moreMessages[0]._id, messages[messages.length - 1])
            }
            for (let i = 1; i < moreMessages.length; i++) {
                preMessagesMapping.set(moreMessages[i]._id, moreMessages[i - 1])
            }
            // --- end of previous message linking ---

            messages = [...messages, ...moreMessages]
            nextPage = moreMessagesObj.nextPage
            scrollDisabled = false
            loadIsThrottled = false
        }

        // スクロール位置を保存
        throttledSaveScrollPosition();
    }
    // debounce handleScroll
    const debouncedHandleScroll = debounce(handleScroll, 250)

    function scrollToMessageIdF(messageId: string, instant: boolean = false) {
        if (!scrollContainer) {
            return
        }
        if (messageId === "last" || messageId === "bottom") {
            scrollContainer.scrollTop = scrollContainer.scrollHeight
            return
        }
        if (messageId === "first" || messageId === "top") {
            scrollContainer.scrollTop = 0
            return
        }
        const messageElement = scrollContainer.querySelector(`[data-messageid="${messageId}"]`)
        if (messageElement) {
            const containerRect = scrollContainer.getBoundingClientRect();
            const elementRect = messageElement.getBoundingClientRect();
            
            const offset = elementRect.top - containerRect.top + scrollContainer.scrollTop;
            const targetScrollTop = offset - scrollContainer.clientHeight / 2 + elementRect.height / 2;

            scrollContainer.scrollTo({
                top: targetScrollTop,
                behavior: instant ? "auto" : ($jumpToMessageAnimated ? "smooth" : "auto")
            });
        }
    }

    let initialCenteringInterval: ReturnType<typeof setInterval> | null = null;

    onMount(async () => {
        const newMessages = await fetchMessages("around", scrollToMessageId, MSGCOUNT_INITIAL)
        messages = newMessages.messages

        // --- link previous messages ---
        for (let i = 1; i < messages.length; i++) {
            preMessagesMapping.set(messages[i]._id, messages[i - 1])
        }
        // --- end of previous message linking ---

        prevPage = newMessages.prevPage
        nextPage = newMessages.nextPage
        await tick();  // wait for render
        
        // アプリ起動直後は画像の遅延読み込みなどでDOMの高さが変わりやすいため、
        // scrollDisabled が解除されるまでの間は定期的にスクロール位置を補正し続ける
        initialCenteringInterval = setInterval(() => {
            if (scrollDisabled && scrollToMessageId) {
                scrollToMessageIdF(scrollToMessageId, true);
            }
        }, 50);

        setTimeout(() => {
            if (initialCenteringInterval) {
                clearInterval(initialCenteringInterval);
                initialCenteringInterval = null;
            }
            scrollDisabled = false
        }, 1500)
        isLoading = false
    })

    // コンポーネント破棄時・アプリ終了時にスクロール位置を即時保存
    function handleBeforeUnload() {
        saveCurrentScrollPosition();
    }

    onMount(() => {
        window.addEventListener('beforeunload', handleBeforeUnload);
    });

    onDestroy(() => {
        if (initialCenteringInterval) {
            clearInterval(initialCenteringInterval);
        }
        // throttle 待ちをキャンセルして即時保存
        throttledSaveScrollPosition.cancel();
        saveCurrentScrollPosition();
        window.removeEventListener('beforeunload', handleBeforeUnload);
    });
</script>

{#if emptySnippet && !isLoading && messages.length === 0}
    {@render emptySnippet()}
{:else}
    <div class="wrapper">
        {#if SHOWDEBUG}
            <small class="debug-container">scrollToMessageId {scrollToMessageId}</small>
        {/if}
        <div class="scroll-container" onscroll={handleScroll} bind:this={scrollContainer}>
            {#if !prevPage && channelStartSnippet && messages && messages.length > 0}
                {@render channelStartSnippet(messages[0])}
            {/if}
            {#each messages as message, i (message._id)}
                <!--
                    - skip the render of the first message if it is not the true first message,
                    else the message would render without a reference to the previous (not yet loaded) message

                    - we could not rerender it later without causing a re-render of the whole list

                    - this issue is not present in the other direction (for the last message), because at that point the previous message is already loaded
                -->
                {#if !(prevPage && i === 0)}
                    <div class="message" data-messageid={message._id}>
                        {@render snippetMessage(message, preMessagesMapping.get(message._id, null))}
                    </div>
                {/if}
            {/each}
        </div>
    </div>
{/if}



<style>
    .wrapper {
        height: 100%;
        display: flex;
        flex-direction: column;
    }
    .message {
        min-height: 30px;
    }
    .scroll-container {
        flex: 1;
        overflow-y: auto;
    }


</style>