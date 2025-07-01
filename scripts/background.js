// scripts/background.js

// This function is what we inject into the page to get data.
// It runs in the main world context, so it can access the player.
function getPageData() {
    const player = document.getElementById('movie_player');
    if (player && typeof player.getCurrentTime === 'function') {
        try {
            const stats = player.getStatsForNerds();
            // Prefer the more precise 'cmt' time, but fallback to currentTime
            return {
                time: stats?.cmt || player.getCurrentTime(),
                videoId: stats?.docid || null
            };
        } catch (e) {
            // Fallback if getStatsForNerds fails for any reason
            return { time: player.getCurrentTime(), videoId: null };
        }
    }
    return { time: null, videoId: null };
}

// Listen for messages from the content script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Check if the message is our request for the time
    if (message.type === 'getTimeRequest') {
        const tabId = sender.tab.id;

        // Use the scripting API to execute our function in the page
        browser.scripting.executeScript({
            target: { tabId: tabId },
            func: getPageData,
            world: 'MAIN'
        })
        .then(injectionResults => {
            // Send the result back to the content script
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
            // IMPORTANT: Send an error response back to the content script
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
    
    // Inject CSS first to prevent Flash of Unstyled Content
    browser.scripting.insertCSS({
        target: { tabId: tabId },
        files: ["/css/overlay.css"]
    }).catch(err => console.error("[YTSRT Background] CSS injection failed.", err));
    
    // Then inject the content script
    browser.scripting.executeScript({
      target: { tabId: tabId },
      files: ["/scripts/content.js"]
    }).catch(err => console.error("[YTSRT Background] Content script injection failed.", err));
  }
});