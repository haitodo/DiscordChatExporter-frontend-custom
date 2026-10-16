<script lang="ts">
    import playerPause from "./player/pause.svg?raw"
    import playerPlay from "./player/play.svg?raw"
    import playerRestart from "./player/restart.svg?raw"
    import playerVolumeHigh from "./player/volumeHigh.svg?raw"
    import playerVolumeLow from "./player/volumeLow.svg?raw"
    import playerVolumeMuted from "./player/volumeMuted.svg?raw"
    import openLink from "./player/openLink.svg?raw"
    import filetypeArchive from "./filetype/archive.svg?raw"
    import filetypeAudio from "./filetype/audio.svg?raw"
    import filetypeDocument from "./filetype/document.svg?raw"
    import filetypePdf from "./filetype/pdf.svg?raw"
    import filetypeSpreadsheet from "./filetype/spreadsheet.svg?raw"
    import filetypeUnknown from "./filetype/unknown.svg?raw"
    import dcefEmpty from "./dcef/empty.svg?raw"
    import dcefFilled from "./dcef/filled.svg?raw"
    import replyAttachment from "./reply/attachment.svg?raw"
    import replyDeleted from "./reply/deleted.svg?raw"
    import systemMessageBoost from "./systemmessage/boost.svg?raw"
    import systemMessageJoin from "./systemmessage/join.svg?raw"
    import systemMessageLeave from "./systemmessage/leave.svg?raw"
    import systemMessageEdit from "./systemmessage/edit.svg?raw"
    import call from "./systemmessage/call.svg?raw"
    import pinned from "./systemmessage/pinned.svg?raw"
    import channel from "./channeltype/channel.svg?raw"
    import channelWithThreads from "./channeltype/channelWithThreads.svg?raw"
    import news from "./channeltype/news.svg?raw"
    import voice from "./channeltype/voice.svg?raw"
    import thread from "./channeltype/thread.svg?raw"
    import poop from "./placeholder/poop.svg?raw"
    import noPins from "./placeholder/no-pins.svg?raw"
    import noSearchResults from "./placeholder/no-search-results.svg?raw"

    import download from "./other/download.svg?raw"
    import dropdown from "./other/dropdown.svg?raw"
    import hamburger from "./other/hamburger.svg?raw"
    import settings from "./other/settings.svg?raw"
    import shield from "./other/shield.svg?raw"
    import verified from "./other/verified.svg?raw"
    import magnifyingGlass from "./other/magnifying-glass.svg?raw"
    import help from "./other/help.svg?raw"
    import bin from "./other/bin.svg?raw"
    import plus from "./other/plus.svg?raw"
    import bookmark from "./other/bookmark.svg?raw"
    import bookmarkFilled from "./other/bookmark-filled.svg?raw"

    import arrowUp from "./modal/arrowUp.svg?raw"
    import modalX from "./modal/x.svg?raw"

    const icons = {
        "player/pause": playerPause,
        "player/play": playerPlay,
        "player/restart": playerRestart,
        "player/volumeHigh": playerVolumeHigh,
        "player/volumeLow": playerVolumeLow,
        "player/volumeMuted": playerVolumeMuted,
        "player/openLink": openLink,
        "filetype/archive": filetypeArchive,
        "filetype/audio": filetypeAudio,
        "filetype/document": filetypeDocument,
        "filetype/pdf": filetypePdf,
        "filetype/spreadsheet": filetypeSpreadsheet,
        "filetype/unknown": filetypeUnknown,
        "dcef/empty": dcefEmpty,
        "dcef/filled": dcefFilled,
        "reply/attachment": replyAttachment,
        "reply/deleted": replyDeleted,
        "systemmessage/boost": systemMessageBoost,
        "systemmessage/join": systemMessageJoin,
        "systemmessage/leave": systemMessageLeave,
        "systemmessage/edit": systemMessageEdit,
        "systemmessage/call": call,
        "systemmessage/pinned": pinned,
        "channeltype/channel": channel,
        "channeltype/channelWithThreads": channelWithThreads,
        "channeltype/news": news,
        "channeltype/voice": voice,
        "channeltype/thread": thread,
        "placeholder/poop": poop,
        "placeholder/no-pins": noPins,
        "placeholder/no-search-results": noSearchResults,
        "other/download": download,
        "other/dropdown": dropdown,
        "other/hamburger": hamburger,
        "other/settings": settings,
        "other/shield": shield,
        "other/verified": verified,
        "other/magnifying-glass": magnifyingGlass,
        "other/help": help,
        "other/bin": bin,
        "other/plus": plus,
        "other/bookmark": bookmark,
        "other/bookmark-filled": bookmarkFilled,
        "modal/arrowUp": arrowUp,
        "modal/x": modalX,
    } as const;

    type IconOptions = keyof typeof icons;

    function getIcon(name: IconOptions): string | undefined {
        return Object.prototype.hasOwnProperty.call(icons, name) ? icons[name] : undefined;
    }

	interface MyProps {
        name: IconOptions;
        width: number;
        height?: number;
        inline?: boolean;
    }
    let { name, width, height: inputHeight, inline=false }: MyProps = $props();
    let height = $derived(inputHeight ? inputHeight : width);
    let icon = $derived(getIcon(name));
</script>

<div class="icon" class:inline={inline} style="width: {width}px; height: {height}px;">
    {#if icon}
        {@html icon}
    {:else}
        <div>Icon "{name}" not found</div>
    {/if}
</div>

<style>
    .icon {
        display: grid;
        place-items: center;
    }

    .icon > :global(svg) {
        width: 100%;
        height: 100%;
    }
</style>
