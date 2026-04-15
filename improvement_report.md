# パフォーマンス・見た目 改善提案レポート

> [!NOTE]
> バグが発生しうる修正は除外済み。すべてリスクが低く、安全に適用可能な改善点のみ記載しています。

---

## 1. パフォーマンス改善

### 1-1. `console.log` の大量残存（全体）

**影響**: 本番環境でのパフォーマンス低下、特にスクロール時に顕著  
**重要度**: ★★★★☆

コードベース全体に大量の `console.log` / `console.warn` が残っている。特に以下は**スクロール中やレンダリング中に毎回発火する**ため、パフォーマンスに直接影響する。

| ファイル | 行 | 内容 |
|---|---|---|
| [InfiniteScroll3.svelte](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/lib/InfiniteScroll3.svelte#L32) | 32 | `console.log('loadf throttled')` — スクロール中に頻繁に発火 |
| [InfiniteScroll3.svelte](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/lib/InfiniteScroll3.svelte#L43) | 43 | `console.log('top reached')` |
| [InfiniteScroll3.svelte](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/lib/InfiniteScroll3.svelte#L73) | 73 | `console.log('bottom reached')` |
| [markdownParser.ts](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/js/markdownParser.ts#L321) | 321 | `console.log("emote", emote)` — **絵文字パース中にループ内で毎回出力**。メッセージに絵文字が多いと深刻 |
| [helpers.ts](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/js/helpers.ts#L11) | 11 | `console.warn('online url', url)` — 画像・アバター読み込みのたびに発火 |
| [Message.svelte](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/lib/message/Message.svelte#L68) | 68 | `console.log("should merge - NO PREVIOUS MESSAGE")` — 最初のメッセージ表示のたびに発火 |
| [Guilds.svelte](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/lib/Guilds.svelte#L11) | 11 | `console.log("right click", id)` |
| [api.ts](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/js/stores/api.ts#L156) | 156 | `console.log("aaaaaa fetchCategoriesChannelsThreads", guildId)` — デバッグ用の文字列がそのまま |
| [MesssageSpoilerHandler.svelte](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/lib/MesssageSpoilerHandler.svelte#L6-L19) | 6, 19 | `console.log(e.target)` / `console.log()` — クリックのたびに発火 |
| [MessageEmbed.svelte](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/lib/message/MessageEmbed.svelte#L82-L93) | 82-93 | `console.log('author icon error', ...)` 等 |

**対応方法**: すべての `console.log` / `console.warn` を削除する。または `import.meta.env.DEV` で囲んで開発時のみ出力する。

---

### 1-2. `highlight.js` のフルバンドルインポート

**影響**: バンドルサイズの増大（highlight.jsはフルインポートで数百KB）  
**重要度**: ★★★☆☆

[markdownParser.ts L6](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/js/markdownParser.ts#L6):
```ts
import hljs from 'highlight.js';
```

highlight.jsの全言語をバンドルしている。実際に使う言語だけを個別インポートするか、`highlight.js/lib/core` + 必要な言語のみを登録する形に変更すれば、バンドルサイズを**〜200KB以上**削減できる。

**対応例**:
```ts
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/languages/javascript';
import python from 'highlight.js/languages/python';
import css from 'highlight.js/languages/css';
// 他の使用言語...
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('css', css);
```

> [!TIP]
> Discordで最も使われる言語は `js`, `ts`, `python`, `css`, `html`, `json`, `bash`, `cpp`, `java`, `csharp`, `sql`, `rust`, `go` あたり。これらだけ登録すれば大半のケースをカバーできる。

---

### 1-3. `lodash-es` の部分インポートの確認

**影響**: 軽微（tree-shakingが効いている可能性あり）  
**重要度**: ★★☆☆☆

[App.svelte L3](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/App.svelte#L3) / [InfiniteScroll3.svelte L3](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/lib/InfiniteScroll3.svelte#L3):
```ts
import {throttle} from 'lodash-es';
import {throttle, debounce} from 'lodash-es';
```

`lodash-es` はES Module版なのでViteのtree-shakingが効くはずだが、実際にバンドルに含まれる量はビルド出力を確認する必要がある。もし不要なモジュールが含まれている場合は `lodash.throttle` / `lodash.debounce` の個別パッケージに切り替えるとよい。

---

### 1-4. `font-display: swap` の欠如によるFOIT（Flash of Invisible Text）

**影響**: 初期読み込み時にテキストが一時的に見えなくなる  
**重要度**: ★★★☆☆

[app.css L26-L124](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/app.css#L26-L124):

すべての `@font-face` 宣言に `font-display` プロパティが設定されていない。デフォルトの `auto` はブラウザ依存で、フォント読み込み中にテキストが非表示になる（FOIT）可能性がある。

**対応方法**: 各 `@font-face` に `font-display: swap;` を追加。

```css
@font-face {
    src: url(/fonts/whitney-300.woff);
    font-family: Whitney;
    font-weight: 300;
    font-display: swap; /* 追加 */
}
```

---

### 1-5. `moment.js` の使用

**影響**: バンドルサイズの増大（moment.jsは〜300KB近い）  
**重要度**: ★★★☆☆

[package.json](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/package.json#L25):
```json
"moment": "^2.29.4"
```

`moment.js` はメンテナンスモードであり、そのサイズは大きい。`dayjs`（2KB）や `date-fns` へ移行すればバンドルサイズを大幅に削減できる。ただし、**既存のフォーマット文字列を変更する必要がある可能性があり、既存のtime.tsの利用箇所を確認の上で慎重に対応すべき**。

---

### 1-6. 画像の `loading="lazy"` 属性未設定

**影響**: 初期表示時に画面外の画像もすべて読み込まれる  
**重要度**: ★★★☆☆

以下の画像表示コンポーネントで `loading="lazy"` が設定されていない：

- [MessageAvatar.svelte L11](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/lib/message/MessageAvatar.svelte#L11) — アバター画像
- [Image.svelte L48-L56](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/lib/imagegallery/Image.svelte#L48-L56) — 添付画像
- [MessageEmbed.svelte L123](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/lib/message/MessageEmbed.svelte#L123) — 埋め込みサムネイル
- [Guilds.svelte L48](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/lib/Guilds.svelte#L48) — サーバーアイコン

**対応方法**: `<img>` タグに `loading="lazy"` を追加。ただしサーバーアイコン（Guilds）はサイドバーに常時表示されるので除外してもよい。

---

### 1-7. `getMessageState` 内でのリスト反復による正規表現の再生成

**影響**: メッセージが多い場合に軽微な遅延  
**重要度**: ★★☆☆☆

[Message.svelte L47-L56](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/lib/message/Message.svelte#L47-L56):

`inviteIds` 関数が `while (match)` ループで正規表現マッチと`replace`を繰り返している。`matchAll`を使えばよりシンプルかつ効率的になる。

---

## 2. 見た目・UI改善

### 2-1. スクロールバーのCSS重複

**影響**: メンテナンス性の低下  
**重要度**: ★★☆☆☆

以下2箇所でまったく同じスクロールバーCSSが重複している：

- [InfiniteScroll3.svelte L187-L214](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/lib/InfiniteScroll3.svelte#L187-L214)
- [Thread.svelte L193-L220](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/lib/Thread.svelte#L193-L220)

**対応方法**: 共通のCSSクラスとして `app.css` に抽出するか、CSSユーティリティクラスとして定義する。

---

### 2-2. ホバーエフェクトの不足（ヘッダーアイコン類）

**影響**: インタラクティブ要素のアフォーダンス不足  
**重要度**: ★★☆☆☆

[HeaderMain.svelte L47-L54](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/lib/HeaderMain.svelte#L47-L54) / [Thread.svelte L66-L73](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/lib/Thread.svelte#L66-L73):

↑↓ジャンプボタンやピンアイコンに、ホバー時の**背景色変化やスケールアニメーション**がない。Discordの本家UIでは、これらのアイコンにホバーすると背景色が変わる。

**対応方法**: アイコンボタンに以下のようなホバースタイルを追加：
```css
.jump-btn, .pin-btn, .icon {
    padding: 4px;
    border-radius: 4px;
    transition: background-color 0.15s ease;
}
.jump-btn:hover, .pin-btn:hover, .icon:hover {
    background-color: rgba(79, 84, 92, 0.32);
}
```

---

### 2-3. メッセージホバー時の背景色がない

**影響**: メッセージの視認性・操作性の低下  
**重要度**: ★★★☆☆

[Message.svelte L192-L204](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/lib/message/Message.svelte#L192-L204):

Discord本家では、メッセージにカーソルを置くと背景色が薄く変化する。現在の実装にはこれがない。

**対応方法**:
```css
.message:hover {
    background-color: rgba(4, 4, 5, 0.07);
}
```

---

### 2-4. `font-weight: 400px` の誤記（CSS値に `px` は不要）

**影響**: 正しく解釈されない可能性  
**重要度**: ★☆☆☆☆

[MessageAttachments.svelte L144](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/lib/message/MessageAttachments.svelte#L144):
```css
font-weight: 400px; /* ← pxは不要、正しくは font-weight: 400; */
```

---

### 2-5. `.searchbar` の `gap` プロパティ重複

**影響**: 意図しないスタイル値  
**重要度**: ★☆☆☆☆

[HeaderMain.svelte L98-L107](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/lib/HeaderMain.svelte#L98-L107):
```css
.searchbar {
    /* ... */
    gap: 8px;          /* ← 先に 8px を指定 */
    /* ... */
    gap: 5px;          /* ← 後に 5px で上書きされる */
}
```

意図が `5px` なら上の `gap: 8px;` を削除、`8px` なら下を削除する。

---

### 2-6. `:root` セレクタの重複

**影響**: なし（ブラウザは問題なく処理する）、メンテナンス性の低下  
**重要度**: ★☆☆☆☆

[app.css L1-L8](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/app.css#L1-L8):
```css
:root {
  color: white;
  background-color: #242424;
}

:root {
    font-family: Whitney, ...;
}
```

2つの `:root` を1つにまとめるべき。

---

### 2-7. `MessageReferenced.svelte` の `overflow` と `text-overflow` の重複宣言

**影響**: なし（後の宣言が優先される）、メンテナンス性の低下  
**重要度**: ★☆☆☆☆

[MessageReferenced.svelte L110-L122](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/lib/message/MessageReferenced.svelte#L110-L122):
```css
.referenced-content {
    overflow: hidden;          /* 1回目 */
    text-overflow: ellipsis;   /* 1回目 */
    max-height: 19px;
    /* ... */
    white-space: nowrap;
    overflow: hidden;          /* 2回目（重複） */
    text-overflow: ellipsis;   /* 2回目（重複） */
}
```

---

### 2-8. チャンネル終端の「this is the end of the channel」が無装飾の素のテキスト

**影響**: チャンネル終端の見た目が雑  
**重要度**: ★★☆☆☆

[Channel.svelte L28-L31](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/lib/Channel.svelte#L28-L31):
```svelte
<div data-messageid="last">
    this is the end of the channel
</div>
```

スレッドにも同様の素のテキストがある（[Thread.svelte L37-L39](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/lib/Thread.svelte#L37-L39)）。

**対応方法**: チャンネル開始時の `ChannelStart` コンポーネントのように、スタイル付きの「End of channel」コンポーネントを作成するか、最低限テキストをセンタリングして薄い色でスタイルする。

---

### 2-9. `tab` スタイルの `border-radius` 重複宣言

**影響**: なし、メンテナンス性の低下  
**重要度**: ★☆☆☆☆

[Settings.svelte L431-L438](file:///e:/dev/DiscordChatExporter-frontend-custom/src/dcef/frontend/src/lib/settings/Settings.svelte#L431-L438):
```css
.tab {
    /* ... */
    border-radius: 5px;   /* 1回目 */
    /* ... */
    border-radius: 4px;   /* 2回目（上書き） */
}
```

---

## 3. 改善優先度まとめ

| 優先度 | 項目 | カテゴリ |
|---|---|---|
| 🔴 高 | 1-1. `console.log` の削除（特にループ内・スクロール内） | パフォーマンス |
| 🔴 高 | 1-2. `highlight.js` のフルバンドル → 部分インポート | パフォーマンス |
| 🟡 中 | 1-4. `font-display: swap` の追加 | パフォーマンス |
| 🟡 中 | 1-6. `loading="lazy"` の追加 | パフォーマンス |
| 🟡 中 | 2-3. メッセージホバー時の背景色 | 見た目 |
| 🟡 中 | 2-2. ヘッダーアイコンのホバーエフェクト | 見た目 |
| 🟡 中 | 2-8. チャンネル終端のスタイリング | 見た目 |
| 🟢 低 | 1-5. `moment.js` → 軽量ライブラリへの移行 | パフォーマンス |
| 🟢 低 | 2-1. スクロールバーCSS重複の解消 | メンテナンス |
| 🟢 低 | 2-4〜2-7, 2-9. CSS値の誤記・重複の修正 | コード品質 |
