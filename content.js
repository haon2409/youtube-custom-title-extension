(function() {
    const UPDATE_INTERVAL_MS = 5000; // 1000
    const LIVE_UPDATE_TICKS = 10; // 5
    const SETTLE_DURATION_MS = 5000; // 5000
    
    let originalTitle = document.title || 'YouTube';
    let lastSeenVideoId = null;
    let lastUrl = location.href;
    let cachedViews = ""; 
    let liveTickCounter = 0;
    let videoStartTime = 0;
    let hasFirstLiveView = false;
    
    let intervalHandle = null;
    let titleObserver = null;
  
    function abbreviateNumber(viewStr) {
        if (!viewStr) return "";
        // Loại bỏ dấu phẩy/chấm và chuyển về số thuần túy
        const numericValue = parseFloat(viewStr.replace(/[,.]/g, ''));
        if (isNaN(numericValue)) return viewStr;
    
        // Ngưỡng Triệu (M): 1.1M, 10M, 100M
        if (numericValue >= 1000000) {
            return (numericValue / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        }
        
        // Ngưỡng chục nghìn trở lên: 10k, 100k, 999k (Không dùng thập phân)
        if (numericValue >= 10000) {
            return Math.floor(numericValue / 1000) + 'k';
        }
    
        // Ngưỡng nghìn (dưới 10k): 1.3k, 5k, 9.9k (Có 1 chữ số thập phân)
        if (numericValue >= 1000) {
            return (numericValue / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
        }
    
        // Dưới 1.000: Giữ nguyên số
        return Math.floor(numericValue).toString();
    }

    function formatSeconds(totalSeconds) {
        if (!isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
        totalSeconds = Math.floor(totalSeconds);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return h > 0 
            ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` 
            : `${m}:${String(s).padStart(2,'0')}`;
    }

    function fetchViewsFromDOM() {
        const viewCountDiv = document.querySelector('#view-count.ytd-watch-info-text');
        if (viewCountDiv) {
            const label = viewCountDiv.getAttribute('aria-label');
            if (label) {    
                const match = label.match(/[\d.,]+/);
                if (match) return abbreviateNumber(match[0].trim());
            }
        }
        let viewEl = document.querySelector('ytd-video-view-count-renderer span.view-count') || 
                     document.querySelector('.view-count') ||
                     document.querySelector('ytd-watch-metadata #description-inline-expander span.bold');
        
        if (viewEl && viewEl.innerText.trim().length > 0) {           
            const rawView = viewEl.innerText.trim().split(/\s/)[0];
            return abbreviateNumber(rawView);
        }
        return "";
    }
  
    function isLiveVideo() {
        return !!document.querySelector('.ytp-live-badge[aria-disabled="false"], .ytp-live');
    }
  
    function getVideoIdFromUrl() {
        try {
            const url = new URL(location.href);
            return url.searchParams.get('v') || url.pathname.split('/')[2] || null;
        } catch (e) { return null; }
    }
  
    function isOurTitle(t) {
        if (!t) return false;
        return /^([\d.,]+[kMtr]?|Live|●) - /.test(t);
    }
  
    function updateEverything() {
        const vidId = getVideoIdFromUrl();
        const currentUrl = location.href;
        const isLive = isLiveVideo();
        const now = Date.now();
  
        if (currentUrl !== lastUrl || (vidId && vidId !== lastSeenVideoId)) {
            lastUrl = currentUrl;
            lastSeenVideoId = vidId;
            cachedViews = ""; 
            liveTickCounter = 0;
            videoStartTime = now;
            hasFirstLiveView = false;
            if (!isOurTitle(document.title)) originalTitle = document.title;
        }
  
        let prefixParts = [];

        if (isLive) {
            if (!hasFirstLiveView || liveTickCounter % LIVE_UPDATE_TICKS === 0) {
                const currentLiveViews = fetchViewsFromDOM();
                if (currentLiveViews) {
                    cachedViews = currentLiveViews;
                    hasFirstLiveView = true;
                }
            }
            liveTickCounter++;
            if (cachedViews) prefixParts.push(cachedViews);
            prefixParts.push("●"); 
        } else {
            const video = document.querySelector('video');
            if (video && isFinite(video.duration) && video.duration > 0) {
                if (now - videoStartTime < SETTLE_DURATION_MS) {
                    const freshViews = fetchViewsFromDOM();
                    if (freshViews) cachedViews = freshViews;
                } else if (!cachedViews) {
                    const lateViews = fetchViewsFromDOM();
                    if (lateViews) cachedViews = lateViews;
                }
                
                if (cachedViews) prefixParts.push(cachedViews);
                const remainingStr = formatSeconds(
                    (video.duration - video.currentTime) / (video.playbackRate || 1)
                );
                prefixParts.push(remainingStr);
            }
        }

        if (prefixParts.length > 0) {
            const newTitle = `${prefixParts.join(' - ')} - ${originalTitle}`;
            if (document.title !== newTitle) {
                document.title = newTitle;
            }
        }
    }
  
    const titleEl = document.querySelector('title');
    if (titleEl) {
        titleObserver = new MutationObserver(() => {
            if (!isOurTitle(document.title)) originalTitle = document.title;
        });
        titleObserver.observe(titleEl, { childList: true });
    }
  
    if (intervalHandle) clearInterval(intervalHandle);
    intervalHandle = setInterval(updateEverything, UPDATE_INTERVAL_MS);
    updateEverything();
})();