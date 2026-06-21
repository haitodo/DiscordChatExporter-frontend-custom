<script lang="ts">
    import { getBookmarksStore, deleteBookmark, updateBookmarkNote, deleteCheckpoint } from "../js/stores/bookmarkStore.svelte";
    import { getGuildState } from "../js/stores/guildState.svelte";
    import { getLayoutState } from "../js/stores/layoutState.svelte";
    import Message from "./message/Message.svelte";
    import Icon from "./icons/Icon.svelte";
    import { onMount } from "svelte";

    const bookmarksStore = getBookmarksStore();
    const guildState = getGuildState();
    const layoutState = getLayoutState();

    // アクティブなタブ: 'bookmarks' | 'checkpoints'
    let activeTab = $state<'bookmarks' | 'checkpoints'>('bookmarks');

    // 編集中のノートの一時保存 (キー: bookmark._id, 値: string)
    let editingNotes = $state<Record<string, string>>({});

    function startEditing(id: string, initialNote: string) {
        editingNotes[id] = initialNote;
    }

    async function saveNote(guildId: string, messageId: string, id: string) {
        const note = editingNotes[id] || "";
        await updateBookmarkNote(guildId, messageId, note);
        // 編集状態をクリア
        delete editingNotes[id];
    }

    function cancelEditing(id: string) {
        delete editingNotes[id];
    }

    async function removeBookmark(guildId: string, messageId: string) {
        if (confirm("このブックマークを削除しますか？")) {
            await deleteBookmark(guildId, messageId);
        }
    }

    async function removeCheckpoint(guildId: string, channelId: string) {
        if (confirm("この読了チェックポイントを削除しますか？")) {
            await deleteCheckpoint(guildId, channelId);
        }
    }

    async function jumpToCheckpoint(guildId: string, channelId: string, messageId: string) {
        await guildState.comboSetGuildChannelMessage(guildId, channelId, messageId);
        await guildState.pushState();
        layoutState.hideBookmarks();
    }
</script>

<div class="bookmarks-panel">
    <div class="panel-header">
        <div class="header-title">
            <Icon name="other/bookmark" width={20} />
            <span>ブックマーク & 読了進捗</span>
        </div>
        <button class="close-btn" onclick={layoutState.hideBookmarks} title="閉じる">
            <Icon name="modal/x" width={18} />
        </button>
    </div>

    <!-- タブ切り替え部 -->
    <div class="tab-header">
        <button class="tab-btn" class:active={activeTab === 'bookmarks'} onclick={() => activeTab = 'bookmarks'}>
            お気に入り ({bookmarksStore.bookmarks.length})
        </button>
        <button class="tab-btn" class:active={activeTab === 'checkpoints'} onclick={() => activeTab = 'checkpoints'}>
            読了チェックポイント ({Object.keys(bookmarksStore.checkpoints).length})
        </button>
    </div>

    <!-- コンテンツ表示部 -->
    <div class="panel-content scrollable">
        {#if activeTab === 'bookmarks'}
            {#if bookmarksStore.bookmarks.length === 0}
                <div class="empty-state">
                    <Icon name="placeholder/no-pins" width={80} />
                    <p>お気に入りのメッセージはありません。</p>
                    <span class="tip">メッセージを右クリックして「お気に入りに追加」を選択してください。</span>
                </div>
            {:else}
                <div class="bookmarks-list">
                    {#each bookmarksStore.bookmarks as b (b._id)}
                        <div class="bookmark-item">
                            <!-- メタ情報ヘッダー -->
                            <div class="item-meta">
                                <span class="server-name">{b.guild_name}</span>
                                <span class="separator">/</span>
                                <span class="channel-name">#{b.channel_name}</span>
                            </div>

                            <!-- メッセージプレビュー -->
                            <div class="message-container">
                                <Message message={b.message} previousMessage={null} showJump={true} mergeMessages={false} />
                            </div>

                            <!-- メモ/ノートセクション -->
                            <div class="note-section">
                                {#if editingNotes[b._id] !== undefined}
                                    <div class="note-edit">
                                        <textarea 
                                            class="note-textarea"
                                            bind:value={editingNotes[b._id]}
                                            placeholder="メモを入力してください..."
                                            rows="2"
                                        ></textarea>
                                        <div class="note-edit-actions">
                                            <button class="btn btn-save" onclick={() => saveNote(b.guild_id, b.message_id, b._id)}>保存</button>
                                            <button class="btn btn-cancel" onclick={() => cancelEditing(b._id)}>キャンセル</button>
                                        </div>
                                    </div>
                                {:else}
                                    <div class="note-display">
                                        {#if b.note}
                                            <p class="note-text"><span class="note-label">メモ:</span> {b.note}</p>
                                        {:else}
                                            <p class="note-text empty-note">メモはありません。</p>
                                        {/if}
                                        <div class="note-actions">
                                            <button class="action-link" onclick={() => startEditing(b._id, b.note || "")}>編集</button>
                                            <span class="action-separator">|</span>
                                            <button class="action-link delete" onclick={() => removeBookmark(b.guild_id, b.message_id)}>削除</button>
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        {:else if activeTab === 'checkpoints'}
            {@const checkpointsList = Object.values(bookmarksStore.checkpoints)}
            {#if checkpointsList.length === 0}
                <div class="empty-state">
                    <Icon name="placeholder/no-pins" width={80} />
                    <p>読了チェックポイントはありません。</p>
                    <span class="tip">メッセージを右クリックして「ここまで読んだ」を選択すると設定できます。</span>
                </div>
            {:else}
                <div class="checkpoints-list">
                    {#each checkpointsList as cp (cp._id)}
                        <div class="checkpoint-item" onclick={() => jumpToCheckpoint(cp.guild_id, cp.channel_id, cp.message_id)} role="button" tabindex="0">
                            <div class="checkpoint-info">
                                <div class="checkpoint-meta">
                                    <span class="server">{cp.guild_name}</span>
                                    <span class="channel">#{cp.channel_name}</span>
                                </div>
                                <div class="checkpoint-time">
                                    最終更新: {new Date(cp.updated_at).toLocaleString('ja-JP')}
                                </div>
                            </div>
                            <div class="checkpoint-actions">
                                <div class="checkpoint-action">
                                    <span class="jump-label">ジャンプ</span>
                                    <Icon name="modal/arrowUp" width={16} />
                                </div>
                                <button class="delete-btn" onclick={(e) => { e.stopPropagation(); removeCheckpoint(cp.guild_id, cp.channel_id); }} title="削除">
                                    <Icon name="other/bin" width={16} />
                                </button>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        {/if}
    </div>
</div>

<style>
    .bookmarks-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: #2b2d31;
        border-left: 1px solid #202225;
        color: #dbdee1;
    }

    .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background-color: #1e1f22;
        border-bottom: 1px solid #202225;
        height: 48px;
        box-sizing: border-box;
    }

    .panel-header .header-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: 600;
        color: #f2f3f5;
    }

    .panel-header .close-btn {
        background: none;
        border: none;
        color: #b5bac1;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
    }

    .panel-header .close-btn:hover {
        color: #dbdee1;
        background-color: rgba(79, 84, 92, 0.32);
    }

    .tab-header {
        display: flex;
        background-color: #2b2d31;
        border-bottom: 1px solid #202225;
        padding: 4px 8px;
    }

    .tab-header .tab-btn {
        flex: 1;
        background: none;
        border: none;
        color: #b5bac1;
        padding: 8px 12px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        border-radius: 4px;
        transition: background-color 0.15s, color 0.15s;
    }

    .tab-header .tab-btn:hover {
        color: #dbdee1;
        background-color: rgba(79, 84, 92, 0.16);
    }

    .tab-header .tab-btn.active {
        color: #f2f3f5;
        background-color: rgba(79, 84, 92, 0.32);
    }

    .panel-content {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
    }

    .panel-content::-webkit-scrollbar {
        width: 8px;
    }
    .panel-content::-webkit-scrollbar-track {
        background: #2b2d31;
    }
    .panel-content::-webkit-scrollbar-thumb {
        background: #1e1f22;
        border-radius: 4px;
    }
    .panel-content::-webkit-scrollbar-thumb:hover {
        background: #111214;
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 70%;
        color: #949ba4;
        text-align: center;
    }

    .empty-state p {
        font-size: 16px;
        font-weight: 600;
        margin-top: 16px;
        margin-bottom: 8px;
        color: #dbdee1;
    }

    .empty-state .tip {
        font-size: 12px;
        max-width: 250px;
        line-height: 1.4;
    }

    .bookmarks-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .bookmark-item {
        background-color: #313338;
        border: 1px solid #202225;
        border-radius: 8px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        position: relative;
    }

    .item-meta {
        font-size: 12px;
        font-weight: 600;
        color: #949ba4;
        display: flex;
        gap: 4px;
    }

    .item-meta .server-name {
        color: #dbdee1;
    }
    .item-meta .channel-name {
        color: #00a8fc;
    }

    .message-container {
        border-left: 2px solid #202225;
        background-color: rgba(43, 45, 49, 0.4);
        border-radius: 0 4px 4px 0;
        padding: 4px 0;
        overflow: hidden;
    }

    .note-section {
        background-color: #2b2d31;
        border-radius: 6px;
        padding: 8px 12px;
        margin-top: 4px;
    }

    .note-textarea {
        width: 100%;
        background-color: #1e1f22;
        border: 1px solid #202225;
        color: #dbdee1;
        border-radius: 4px;
        padding: 8px;
        font-family: inherit;
        font-size: 13px;
        resize: vertical;
        box-sizing: border-box;
    }

    .note-textarea:focus {
        outline: none;
        border-color: #5865f2;
    }

    .note-edit-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 8px;
    }

    .note-edit-actions .btn {
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 500;
        border-radius: 3px;
        cursor: pointer;
        border: none;
    }
    .note-edit-actions .btn-save {
        background-color: #23a55a;
        color: white;
    }
    .note-edit-actions .btn-save:hover {
        background-color: #1a7f45;
    }
    .note-edit-actions .btn-cancel {
        background-color: #4e5058;
        color: #dbdee1;
    }
    .note-edit-actions .btn-cancel:hover {
        background-color: #6d6f78;
    }

    .note-display {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .note-display .note-text {
        font-size: 13px;
        color: #dbdee1;
        margin: 0;
        line-height: 1.4;
        white-space: pre-wrap;
    }
    .note-display .note-label {
        font-weight: 600;
        color: #949ba4;
    }
    .note-display .empty-note {
        color: #949ba4;
        font-style: italic;
    }

    .note-actions {
        display: flex;
        gap: 8px;
        font-size: 12px;
        align-self: flex-end;
    }

    .note-actions .action-link {
        background: none;
        border: none;
        color: #00a8fc;
        padding: 0;
        cursor: pointer;
    }
    .note-actions .action-link:hover {
        text-decoration: underline;
    }
    .note-actions .action-link.delete {
        color: #da373c;
    }
    .note-actions .action-link.delete:hover {
        color: #fa777c;
    }
    .note-actions .action-separator {
        color: #4e5058;
    }

    .checkpoints-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .checkpoint-item {
        background-color: #313338;
        border: 1px solid #202225;
        border-radius: 6px;
        padding: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        transition: background-color 0.15s, border-color 0.15s;
    }

    .checkpoint-item:hover {
        background-color: #35373c;
        border-color: #4e5058;
    }

    .checkpoint-item .checkpoint-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .checkpoint-item .checkpoint-meta {
        display: flex;
        gap: 6px;
        font-size: 14px;
        font-weight: 600;
    }

    .checkpoint-item .checkpoint-meta .server {
        color: #dbdee1;
    }
    .checkpoint-item .checkpoint-meta .channel {
        color: #00a8fc;
    }

    .checkpoint-item .checkpoint-time {
        font-size: 11px;
        color: #949ba4;
    }

    .checkpoint-item .checkpoint-action {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #23a55a;
        font-size: 13px;
        font-weight: 600;
    }

    .checkpoint-item .checkpoint-action .jump-label {
        margin-right: 2px;
    }

    .checkpoint-item .checkpoint-action :global(div) {
        transform: rotate(90deg);
    }

    .checkpoint-actions {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .delete-btn {
        background: none;
        border: none;
        color: #949ba4;
        cursor: pointer;
        padding: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background-color 0.15s, color 0.15s;
    }

    .delete-btn:hover {
        color: #fa777c;
        background-color: rgba(250, 119, 124, 0.1);
    }
</style>
