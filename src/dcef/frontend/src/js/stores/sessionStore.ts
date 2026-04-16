/**
 * セッション状態の永続化ストア
 * ナビゲーション状態（ギルド・チャネル・スレッド）とスクロール位置を
 * localStorage に保存・復元するユーティリティ
 */

const SESSION_KEY = 'dcef_session_state';
const SCROLL_KEY_PREFIX = 'dcef_scroll_';

export interface SessionState {
    guild: string | null;
    channel: string | null;
    thread: string | null;
    channelmessage: string | null;
    threadmessage: string | null;
    search: string | null;
}

/**
 * セッション状態を localStorage に保存する
 */
export function saveSessionState(state: SessionState): void {
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(state));
    } catch (e) {
        console.warn('sessionStore - セッション状態の保存に失敗', e);
    }
}

/**
 * localStorage からセッション状態を取得する
 * 保存データがない場合は null を返す
 */
export function getSessionState(): SessionState | null {
    try {
        const json = localStorage.getItem(SESSION_KEY);
        if (!json) {
            return null;
        }
        const state = JSON.parse(json) as SessionState;
        // 最低限 guild が存在するか確認
        if (state && typeof state === 'object' && 'guild' in state) {
            return state;
        }
        return null;
    } catch (e) {
        console.warn('sessionStore - セッション状態の取得に失敗', e);
        return null;
    }
}

/**
 * チャネル/スレッドのスクロール位置（メッセージID）を保存する
 * ビューポート中央付近のメッセージIDを保存し、復元時に around で再取得する
 */
export function saveScrollMessageId(channelOrThreadId: string, messageId: string): void {
    if (!channelOrThreadId || !messageId) {
        return;
    }
    // 特殊ID（first, last など）は保存しない
    if (messageId === 'first' || messageId === 'last' || messageId === 'top' || messageId === 'bottom') {
        return;
    }
    try {
        localStorage.setItem(SCROLL_KEY_PREFIX + channelOrThreadId, messageId);
    } catch (e) {
        console.warn('sessionStore - スクロール位置の保存に失敗', e);
    }
}

/**
 * チャネル/スレッドの保存済みスクロール位置（メッセージID）を取得する
 */
export function getScrollMessageId(channelOrThreadId: string): string | null {
    if (!channelOrThreadId) {
        return null;
    }
    try {
        return localStorage.getItem(SCROLL_KEY_PREFIX + channelOrThreadId);
    } catch (e) {
        console.warn('sessionStore - スクロール位置の取得に失敗', e);
        return null;
    }
}
