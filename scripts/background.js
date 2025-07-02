// scripts/background.js

// This function is what we inject into the page to get data.
// It runs in the main world context, so it can access the player.
function getPageData() {
    const player = document.getElementById('movie_player');
    if (player && typeof player.getCurrentTime === 'function') {
        try {
            const stats = player.getStatsForNerds();
            return {
                time: stats?.cmt || player.getCurrentTime(),
                videoId: stats?.docid || null
            };
        } catch (e) {
            return { time: player.getCurrentTime(), videoId: null };
        }
    }
    return { time: null, videoId: null };
}

// --- NEW: Open options page in a tab when the toolbar icon is clicked ---
browser.action.onClicked.addListener((tab) => {
    browser.runtime.openOptionsPage();
});

// Listen for messages from the content script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'getTimeRequest') {
        const tabId = sender.tab.id;

        browser.scripting.executeScript({
            target: { tabId: tabId },
            func: getPageData,
            world: 'MAIN'
        })
        .then(injectionResults => {
            if (browser.runtime.lastError) {
              throw new Error(browser.runtime.lastError.message);
            }
            browser.tabs.sendMessage(tabId, {
                type: 'timeResponse',
                payload: {
                    result: injectionResults[0].result,
                    requestType: message.requestType
                }
            });
        })
        .catch(err => {
            console.error("[YTSRT Background] Script injection failed:", err);
            browser.tabs.sendMessage(tabId, {
                type: 'timeResponse',
                error: err.message || "Failed to execute script."
            }).catch(e => console.error("Failed to send error message to content script:", e));
        });

        return true; // Indicates we will send a response asynchronously
    }
});

// Inject content script and CSS when navigating to a YouTube watch page
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && tab.url.includes("youtube.com/watch") && changeInfo.status === 'complete') {
    
    browser.scripting.insertCSS({
        target: { tabId: tabId },
        files: ["css/overlay.css"]
    }).catch(err => console.error("[YTSRT Background] CSS injection failed.", err));
    
    browser.scripting.executeScript({
      target: { tabId: tabId },
      files: ["scripts/content.js"]
    }).catch(err => console.error("[YTSRT Background] Content script injection failed.", err));
  }
});