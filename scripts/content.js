// scripts/content.js

(() => {
    if (window.hasRunYTSRT) return;
    window.hasRunYTSRT = true;

    // --- STATE VARIABLES ---
    let timerState = 'idle', segmentStartTime = null, totalRunTime = 0, currentVideoId = null;
    let splits = [], keybindings = {}, splitNamePresets = [], copyHeaderText = "";
    let fallbackSplitCounter = 0;
    
    let uiContainer, totalTimeEl, currentSegmentEl, lastSegmentEl, splitsListEl, copyButtonEl, copyConfirmEl, debugLogEl;
    let videoPlayerEl = null, liveTimeUpdateRequest = null;

    const defaultKeybindings = {
        startReset:   { key: 'ü', code: 'BracketLeft', ctrlKey: false, altKey: false, shiftKey: false },
        startSegment: { key: 'ö', code: 'Semicolon',   ctrlKey: false, altKey: false, shiftKey: false },
        endSegment:   { key: 'ä', code: 'Quote',       ctrlKey: false, altKey: false, shiftKey: false },
        endRun:       { key: '$', code: 'Digit4',      ctrlKey: false, altKey: false, shiftKey: true }
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
        const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const s = (totalSeconds % 60).toFixed(3).padStart(6, '0');
        return `${m}:${s}`;
    }

    // --- UI FUNCTIONS ---
    function createUI() {
        if (document.getElementById('yt-speedrun-timer-container')) return;
        uiContainer = document.createElement('div');
        uiContainer.id = 'yt-speedrun-timer-container';
        uiContainer.innerHTML = `
            <div class="srt-title">YT Speedrun Timer</div>
            <div class="srt-time-display"><span>Total:</span><span id="srt-total-time">00:00.000</span></div>
            <div class="srt-time-display"><span>Current:</span><span id="srt-current-segment-time">--:--.---</span></div>
            <div class="srt-time-display"><span>Last:</span><span id="srt-last-segment-time">--:--.---</span></div>
            <div class="srt-splits-container">
                <div class="srt-splits-header"><span>Splits (Click name to edit)</span><button id="srt-copy-button" title="Copy Times"><svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg><span id="srt-copy-confirm">Copied!</span></button></div>
                <ul id="srt-splits-list"></ul>
            </div>
            <div class="srt-debug-log"><strong>Status:</strong> <span id="srt-debug-message">Loading...</span></div>
        `;
        document.body.appendChild(uiContainer);
        totalTimeEl = document.getElementById('srt-total-time');
        currentSegmentEl = document.getElementById('srt-current-segment-time');
        lastSegmentEl = document.getElementById('srt-last-segment-time');
        splitsListEl = document.getElementById('srt-splits-list');
        copyButtonEl = document.getElementById('srt-copy-button');
        copyConfirmEl = document.getElementById('srt-copy-confirm');
        debugLogEl = document.getElementById('srt-debug-message');
        
        copyButtonEl.addEventListener('click', handleCopy);
        splitsListEl.addEventListener('click', handleSplitNameClick);
    }

    function updateUI() {
        totalTimeEl.textContent = formatTime(totalRunTime);
        splitsListEl.innerHTML = '';
        
        splits.forEach((split, index) => {
            const li = document.createElement('li');
            const nameSpan = `<span class="srt-split-name" data-split-index="${index}">${split.name}</span>`;
            const timeInfo = `${formatTime(split.startTime)} - ${formatTime(split.endTime)} | ${formatTime(split.duration)}`;
            li.innerHTML = `${nameSpan}: ${timeInfo}`;
            splitsListEl.appendChild(li);
        });

        lastSegmentEl.textContent = splits.length > 0 ? formatTime(splits[splits.length - 1].duration) : '--:--.---';
        splitsListEl.scrollTop = splitsListEl.scrollHeight;
    }

    function updateLiveTime() {
        if (timerState !== 'timing_segment' || !videoPlayerEl) return;
        currentSegmentEl.textContent = formatTime(videoPlayerEl.getCurrentTime());
        liveTimeUpdateRequest = requestAnimationFrame(updateLiveTime);
    }

    // --- HANDLER FUNCTIONS ---
    function handleStartReset() {
        if (liveTimeUpdateRequest) cancelAnimationFrame(liveTimeUpdateRequest);
        currentSegmentEl.classList.remove('srt-current-time-active');
        
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
        
        currentSegmentEl.classList.add('srt-current-time-active');
        if (!videoPlayerEl) videoPlayerEl = document.getElementById('movie_player');
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
        currentSegmentEl.classList.remove('srt-current-time-active');
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
    
    function handleCopy() {
        let resultString = copyHeaderText ? `${copyHeaderText}\n\n` : ''; 
        splits.forEach(split => {
            resultString += `${split.name}: ${formatTime(split.startTime)} - ${formatTime(split.endTime)} | ${formatTime(split.duration)}\n`;
        });
        resultString += `\nTotal Run Time: ${formatTime(totalRunTime)}`;
        
        navigator.clipboard.writeText(resultString.trim()).then(() => {
            copyConfirmEl.classList.add('show');
            setTimeout(() => { copyConfirmEl.classList.remove('show'); }, 1500);
        });
    }

    function handleSplitNameClick(e) {
        const target = e.target;
        if (!target.classList.contains('srt-split-name')) return;

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

    // --- MAIN INITIALIZATION ---
    async function init() {
        createUI();
        
        try {
            const data = await browser.storage.sync.get("settings");
            const s = data.settings || {};
            
            keybindings = s.keybindings || defaultKeybindings;
            copyHeaderText = (typeof s.copyHeaderText !== 'undefined') ? s.copyHeaderText : "";

            if (s.presets && s.presets.active) {
                const { group, sub } = s.presets.active;
                if(s.presets.data && s.presets.data[group] && s.presets.data[group][sub]){
                    splitNamePresets = s.presets.data[group][sub];
                }
            } else {
                splitNamePresets = [];
            }
            logDebug("Ready. Using preset: " + (s.presets ? `${s.presets.active.group} > ${s.presets.active.sub}` : "None"));
        } catch(e) {
            logDebug(`Storage Error. Using defaults.`, true);
            keybindings = defaultKeybindings;
        }

        document.addEventListener('keydown', (e) => {
            if (e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            for (const action in keybindings) {
                const kb = keybindings[action];
                if (kb.key === e.key && kb.code === e.code && kb.ctrlKey === e.ctrlKey && kb.altKey === e.altKey && kb.shiftKey === e.shiftKey) {
                    e.preventDefault(); e.stopPropagation();
                    if (action === 'startReset') {
                        handleStartReset();
                    } else {
                        browser.runtime.sendMessage({ type: 'getTimeRequest', requestType: action });
                    }
                    return;
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
                switch(requestType) {
                    case 'startSegment': handleStartSegment(time); break;
                    case 'endSegment': handleEndSegment(time); break;
                    case 'endRun': handleEndRun(time); break;
                }
            }
        });
    }

    init();
})();