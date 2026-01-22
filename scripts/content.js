// scripts/content.js

(() => {
    if (window.hasRunYTFT) return;
    window.hasRunYTFT = true;

    // --- STATE VARIABLES ---
    let timerState = 'idle', segmentStartTime = null, totalRunTime = 0, currentVideoId = null;
    let splits = [], keybindings = {}, splitNamePresets = [], copyHeaderText = "";
    let fallbackSplitCounter = 0;

    let uiContainer, totalTimeEl, currentSegmentEl, lastSegmentEl, splitsListEl, copyButtonEl, copyConfirmEl, debugLogEl;
    let videoPlayerEl = null, liveTimeUpdateRequest = null;

    const defaultKeybindings = {
        startReset: { key: 'ü', code: 'BracketLeft', ctrlKey: false, altKey: false, shiftKey: false },
        startSegment: { key: 'ö', code: 'Semicolon', ctrlKey: false, altKey: false, shiftKey: false },
        endSegment: { key: 'ä', code: 'Quote', ctrlKey: false, altKey: false, shiftKey: false },
        undoSplit: { key: 'Backspace', code: 'Backspace', ctrlKey: false, altKey: false, shiftKey: false },
        endRun: { key: 'c', code: 'KeyC', ctrlKey: true, altKey: false, shiftKey: false },
        toggleVisibility: { key: 'h', code: 'KeyH', ctrlKey: false, altKey: false, shiftKey: false }
    };

    // --- HELPER FUNCTIONS ---
    function logDebug(message, isError = false) {
        if (debugLogEl) {
            debugLogEl.textContent = message;
            debugLogEl.style.color = isError ? '#ff6b6b' : '#6bff94';
        }
    }

    function formatTime(totalSeconds) {
        if (isNaN(totalSeconds) || totalSeconds === null) return "00:00.000";

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const formattedMinutes = String(minutes).padStart(2, '0');
        const formattedSeconds = seconds.toFixed(3).padStart(6, '0');

        if (hours > 0) {
            const formattedHours = String(hours);
            return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
        } else {
            return `${formattedMinutes}:${formattedSeconds}`;
        }
    }

    // --- UI FUNCTIONS ---
    function createUI() {
        if (document.getElementById('yt-frame-timer-container')) return;
        uiContainer = document.createElement('div');
        uiContainer.id = 'yt-frame-timer-container';
        uiContainer.innerHTML = `
            <div class="ytft-title">YT Frame Timer</div>
            <div class="ytft-time-display"><span>Total:</span><span id="ytft-total-time">00:00.000</span></div>
            <div class="ytft-time-display"><span>Current:</span><span id="ytft-current-segment-time">--:--.---</span></div>
            <div class="ytft-time-display"><span>Last:</span><span id="ytft-last-segment-time">--:--.---</span></div>
            <div class="ytft-splits-container">
                <div class="ytft-splits-header"><span>Splits (Click name to edit)</span><button id="ytft-copy-button" title="Copy Times"><svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg><span id="ytft-copy-confirm">Copied!</span></button></div>
                <ul id="ytft-splits-list"></ul>
            </div>
            <div class="ytft-debug-log"><strong>Status:</strong> <span id="ytft-debug-message">Loading...</span></div>
        `;
        document.body.appendChild(uiContainer);
        totalTimeEl = document.getElementById('ytft-total-time');
        currentSegmentEl = document.getElementById('ytft-current-segment-time');
        lastSegmentEl = document.getElementById('ytft-last-segment-time');
        splitsListEl = document.getElementById('ytft-splits-list');
        copyButtonEl = document.getElementById('ytft-copy-button');
        copyConfirmEl = document.getElementById('ytft-copy-confirm');
        debugLogEl = document.getElementById('ytft-debug-message');

        copyButtonEl.addEventListener('click', handleCopy);
        splitsListEl.addEventListener('click', handleSplitNameClick);
    }

    function updateUI() {
        totalTimeEl.textContent = formatTime(totalRunTime);
        splitsListEl.innerHTML = '';

        splits.forEach((split, index) => {
            const li = document.createElement('li');
            const nameSpan = `<span class="ytft-split-name" data-split-index="${index}">${split.name}</span>`;
            const timeInfo = `${formatTime(split.startTime)} - ${formatTime(split.endTime)} | ${formatTime(split.duration)}`;
            li.innerHTML = `${nameSpan}: ${timeInfo}`;
            splitsListEl.appendChild(li);
        });

        lastSegmentEl.textContent = splits.length > 0 ? formatTime(splits[splits.length - 1].duration) : '--:--.---';
        splitsListEl.scrollTop = splitsListEl.scrollHeight;
    }

    function updateLiveTime() {
        if (timerState !== 'timing_segment' || !videoPlayerEl) return;
        const currentDuration = videoPlayerEl.currentTime - segmentStartTime;
        currentSegmentEl.textContent = formatTime(Math.max(0, currentDuration));
        liveTimeUpdateRequest = requestAnimationFrame(updateLiveTime);
    }

    // --- HANDLER FUNCTIONS ---
    function handleStartReset() {
        if (liveTimeUpdateRequest) cancelAnimationFrame(liveTimeUpdateRequest);
        currentSegmentEl.classList.remove('ytft-current-time-active');

        timerState = 'running';
        segmentStartTime = null;
        totalRunTime = 0;
        splits = [];
        fallbackSplitCounter = 0;

        currentSegmentEl.textContent = '--:--.---';
        updateUI();
        uiContainer.classList.remove('finished');
        logDebug("Run started/reset.");
    }

    function handleStartSegment(time) {
        if (timerState === 'timing_segment') return;
        timerState = 'timing_segment';
        segmentStartTime = time;

        currentSegmentEl.classList.add('ytft-current-time-active');
        if (!videoPlayerEl) videoPlayerEl = document.querySelector('video');
        if (videoPlayerEl) {
            liveTimeUpdateRequest = requestAnimationFrame(updateLiveTime);
        }
        uiContainer.classList.remove('finished');
        logDebug(`Segment started at ${formatTime(time)}`);
    }

    function handleEndSegment(time) {
        if (timerState !== 'timing_segment') return;
        if (liveTimeUpdateRequest) cancelAnimationFrame(liveTimeUpdateRequest);

        const segmentDuration = time - segmentStartTime;
        totalRunTime += segmentDuration;

        let splitName;
        if (splitNamePresets && splits.length < splitNamePresets.length) {
            splitName = splitNamePresets[splits.length];
        } else {
            splitName = "Another one?" + "?".repeat(fallbackSplitCounter);
            fallbackSplitCounter++;
        }

        splits.push({
            name: splitName,
            startTime: segmentStartTime,
            endTime: time,
            duration: segmentDuration
        });

        segmentStartTime = null;
        timerState = 'running';
        currentSegmentEl.classList.remove('ytft-current-time-active');
        currentSegmentEl.textContent = '--:--.---';
        logDebug(`Split! Segment time: ${formatTime(segmentDuration)}`);
        updateUI();
    }

    function handleEndRun(time) {
        if (timerState === 'idle' || timerState === 'finished') return;
        if (timerState === 'timing_segment') handleEndSegment(time);
        logDebug(`Run finished. Total: ${formatTime(totalRunTime)}`);
        timerState = 'finished';
        uiContainer.classList.add('finished');
        handleCopy();
    }

    function handleUndo() {
        if (timerState === 'timing_segment') {
            logDebug("Cannot undo while segment is timing. End it first.", true);
            return;
        }
        if (splits.length === 0) {
            logDebug("Nothing to undo.");
            return;
        }

        const undoneSplit = splits.pop();
        totalRunTime -= undoneSplit.duration;

        // Decrement fallback counter if the undone split was a fallback
        const wasFallback = !splitNamePresets || splits.length >= splitNamePresets.length;
        if (wasFallback) {
            fallbackSplitCounter = Math.max(0, fallbackSplitCounter - 1);
        }

        timerState = 'running';
        uiContainer.classList.remove('finished');

        updateUI();
        logDebug(`Undid last split: "${undoneSplit.name}".`);
    }

    function handleToggleVisibility() {
        if (uiContainer) {
            uiContainer.classList.toggle('ytft-hidden');
        }
    }

    function handleCopy() {
        if (splits.length === 0) return;

        let resultString = copyHeaderText ? `${copyHeaderText}\n\n` : '';
        splits.forEach(split => {
            resultString += `${split.name}: ${formatTime(split.startTime)} - ${formatTime(split.endTime)} | ${formatTime(split.duration)}\n`;
        });

        const rtaStart = Math.min(...splits.map(s => s.startTime));
        const rtaEnd = Math.max(...splits.map(s => s.endTime));
        const rtaDuration = rtaEnd - rtaStart;

        resultString += `\nTotal IGT: **${formatTime(totalRunTime)}**`;
        resultString += `\n\nRTA: ${formatTime(rtaStart)} - ${formatTime(rtaEnd)} | **${formatTime(rtaDuration)}**`;

        navigator.clipboard.writeText(resultString.trim()).then(() => {
            copyConfirmEl.classList.add('show');
            setTimeout(() => { copyConfirmEl.classList.remove('show'); }, 1500);
        });
    }

    function handleSplitNameClick(e) {
        const target = e.target;
        if (!target.classList.contains('ytft-split-name')) return;

        target.contentEditable = 'true';
        target.focus();
        document.execCommand('selectAll', false, null);

        const originalName = target.textContent;
        const splitIndex = parseInt(target.dataset.splitIndex, 10);

        const saveAndExit = () => {
            target.contentEditable = 'false';
            const newName = target.textContent.trim();
            if (newName && newName !== originalName) {
                splits[splitIndex].name = newName;
                logDebug(`Split ${splitIndex + 1} renamed to "${newName}".`);
            } else {
                target.textContent = originalName;
            }
            target.removeEventListener('blur', saveAndExit);
            target.removeEventListener('keydown', onKeydown);
        };

        const onKeydown = (keyEvent) => {
            if (keyEvent.key === 'Enter') {
                keyEvent.preventDefault();
                target.blur();
            } else if (keyEvent.key === 'Escape') {
                target.textContent = originalName;
                target.blur();
            }
        };

        target.addEventListener('blur', saveAndExit);
        target.addEventListener('keydown', onKeydown);
    }

    async function getSettingsWithDefaults() {
        try {
            const data = await browser.storage.sync.get("settings");
            let s = data.settings || {};

            // If valid presets exist, return them
            if (s.presets && s.presets.data && Object.keys(s.presets.data).length > 0) {
                return s;
            }

            // Otherwise load defaults
            const url = browser.runtime.getURL('data/DEFAULT.json');
            const response = await fetch(url);
            const defaults = await response.json();

            // Merge defaults. If 's' has some keys use them, else use default.
            // IMPORTANT: Sanitize with JSON.parse/stringify to remove potential XrayWrappers
            // that cause "Not allowed to define cross-origin object" errors in Firefox.
            const cleanSettings = {
                keybindings: s.keybindings || defaultKeybindings,
                copyHeaderText: (typeof s.copyHeaderText !== 'undefined') ? s.copyHeaderText : defaults.copyHeader,
                presets: defaults
            };
            return JSON.parse(JSON.stringify(cleanSettings));
        } catch (e) {
            console.error("YTFT: Error loading settings/defaults", e);
            return { keybindings: defaultKeybindings, presets: null };
        }
    }

    // --- MAIN INITIALIZATION ---
    async function init() {
        createUI();

        try {
            const s = await getSettingsWithDefaults();

            keybindings = s.keybindings || defaultKeybindings;
            copyHeaderText = (typeof s.copyHeaderText !== 'undefined') ? s.copyHeaderText : "Mod edit (Name):";

            if (s.presets && s.presets.active) {
                const { group, sub } = s.presets.active;
                if (s.presets.data && s.presets.data[group] && s.presets.data[group][sub]) {
                    const presetData = s.presets.data[group][sub];
                    splitNamePresets = Array.isArray(presetData) ? presetData : presetData.splits;
                }
                logDebug("Ready. Using preset: " + `${group} > ${sub}`);
            } else {
                splitNamePresets = [];
                logDebug("Ready. No presets found.");
            }
        } catch (e) {
            logDebug(`Init Error: ${e.message}`, true);
            keybindings = defaultKeybindings;
            splitNamePresets = [];
            copyHeaderText = "Mod edit (Name):";
        }

        document.addEventListener('keydown', async (e) => {
            if (e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Auto-detect trigger
            if (e.key.toLowerCase() === 'p') {
                logDebug("Attempting auto-detect...");
                try {
                    const data = await getSettingsWithDefaults();
                    if (!data || !data.presets) {
                        logDebug("No presets to search.", true);
                        return;
                    }

                    // We need 'data' to look like the full settings object for consistency below
                    // If returned from helper, it is the settings object directly.
                    // If we were saving, we would wrap it in { settings: ... }, but here we just read.
                    const settings = data;

                    // Try to find the title element specific to YouTube
                    let videoTitle = document.title;
                    const ytTitleEl = document.querySelector('yt-formatted-string.ytd-watch-metadata');
                    if (ytTitleEl) {
                        videoTitle = ytTitleEl.textContent;
                    }

                    logDebug(`Searching for keywords in: "${videoTitle}"`);

                    const presetsData = settings.presets.data;
                    let found = null;

                    for (const group in presetsData) {
                        for (const sub in presetsData[group]) {
                            const item = presetsData[group][sub];
                            // Handle schema migration (Array vs Object)
                            const keywords = Array.isArray(item) ? [] : (item.keywords || []);

                            for (const kw of keywords) {
                                if (videoTitle.toLowerCase().includes(kw.toLowerCase())) {
                                    found = { group, sub };
                                    break;
                                }
                            }
                            if (found) break;
                        }
                        if (found) break;
                    }

                    if (found) {
                        settings.presets.active = found;
                        // Save the detected fallback as the new user settings
                        await browser.storage.sync.set({ settings: settings });

                        // Update local state
                        const newItem = presetsData[found.group][found.sub];
                        splitNamePresets = Array.isArray(newItem) ? newItem : newItem.splits;

                        // Reset run
                        handleStartReset();
                        logDebug(`Switched to: ${found.sub}`);
                    } else {
                        logDebug("No matching category found in presets.", true);
                    }
                } catch (err) {
                    console.error(err);
                    logDebug("Auto-detect failed due to error.", true);
                }
                return;
            }

            for (const action in keybindings) {
                const kb = keybindings[action];
                if (kb.key === e.key && kb.code === e.code && kb.ctrlKey === e.ctrlKey && kb.altKey === e.altKey && kb.shiftKey === e.shiftKey) {
                    e.preventDefault(); e.stopPropagation();

                    switch (action) {
                        case 'startReset':
                            handleStartReset();
                            break;
                        case 'undoSplit':
                            handleUndo();
                            break;
                        case 'toggleVisibility':
                            handleToggleVisibility();
                            break;
                        // Actions requiring player time
                        case 'startSegment':
                        case 'endSegment':
                        case 'endRun':
                            browser.runtime.sendMessage({ type: 'getTimeRequest', requestType: action });
                            break;
                    }
                    return; // Exit loop once keybinding is found and handled
                }
            }
        });

        browser.runtime.onMessage.addListener((message) => {
            if (message.type === 'timeResponse') {
                if (message.error) {
                    logDebug(`Background error: ${message.error}`, true);
                    return;
                }
                const { result, requestType } = message.payload;
                const { time, videoId } = result;
                if (currentVideoId === null) currentVideoId = videoId;
                if (videoId && videoId !== currentVideoId) {
                    handleStartReset();
                    currentVideoId = videoId;
                    return;
                }
                if (time === null) {
                    logDebug(`Player not ready or found for ${requestType}.`, true);
                    return;
                }
                switch (requestType) {
                    case 'startSegment': handleStartSegment(time); break;
                    case 'endSegment': handleEndSegment(time); break;
                    case 'endRun': handleEndRun(time); break;
                }
            }
        });
    }

    init();
})();