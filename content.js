// content.js - v1.3 (ổn định, chưa thêm logic livestream)

(function() {
    const UPDATE_INTERVAL_MS = 1000;
    let originalTitle = document.title || 'YouTube';
    let lastSeenVideoId = null;
    let intervalHandle = null;
    let titleObserver = null;
  
    function formatSeconds(totalSeconds) {
      if (!isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
      totalSeconds = Math.floor(totalSeconds);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
    }
  
    function getVideoElement() {
      return document.querySelector('video');
    }
  
    function isLiveLabelVisibleOnControls() {
      // Chỉ kiểm tra nhãn LIVE đúng trên thanh điều khiển
      // Selector hợp lệ duy nhất
      const badgeCandidates = ['.ytp-chrome-bottom .ytp-live-badge'];

      const isElVisible = (el) => {
        if (!el) return false;
        if (el.getAttribute('aria-hidden') === 'true') return false;
        if (el.hidden === true) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const style = window.getComputedStyle(el);
        if (!style) return false;
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0) return false;
        return true;
      };

      const isAllowedLiveBadge = (el) => {
        if (!el || !el.classList) return false;
        // Bắt buộc có ytp-live-badge và một trong các class trạng thái bên dưới
        const hasBase = el.classList.contains('ytp-live-badge');
        const hasLiveState = el.classList.contains('ytp-live-badge-is-live') || el.classList.contains('ytp-live-badge-is-livehead');
        return hasBase && hasLiveState;
      };

      for (const sel of badgeCandidates) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          if (!isElVisible(el)) continue;
          if (!isAllowedLiveBadge(el)) continue;
          const text = (el.textContent || '').trim().toUpperCase();
          // Yêu cầu khớp chặt: chính xác là LIVE hoặc bắt đầu bằng LIVE
          if (text === 'LIVE' || text.startsWith('LIVE ')) {
            // Lưu vào window để popup có thể đọc thông tin debug qua response
            window.__ytLiveDetect = {
              matchedSelector: sel,
              className: el.className || '',
              text: (el.textContent || '').trim()
            };
            return true;
          }
        }
      }
      window.__ytLiveDetect = undefined;
      return false;
    }

    function getVideoIdFromUrl() {
      try {
        const url = new URL(location.href);
        // youtu.be/<id>
        if (url.hostname === 'youtu.be') {
          const seg = url.pathname.split('/').filter(Boolean);
          return seg[0] || null;
        }
        // watch?v=<id>
        const vParam = url.searchParams.get('v');
        if (vParam) return vParam;
        // shorts/<id>
        if (url.pathname.startsWith('/shorts/')) {
          const idPart = url.pathname.slice('/shorts/'.length);
          return idPart.split('/')[0] || null;
        }
        return null;
      } catch (e) {
        return null;
      }
    }
  
    function isOurTitle(t) {
      if (!t || typeof t !== 'string') return false;
      const timePattern = /^\d{1,2}:\d{2}(?::\d{2})? - /;
      const ratePattern = /^\d+(?:\.\d+)?x - \d{1,2}:\d{2}(?::\d{2})? - /;
      return timePattern.test(t) || ratePattern.test(t);
    }
  
    function updateTitle() {
      const video = getVideoElement();
      const vidId = getVideoIdFromUrl();
  
      if (vidId && vidId !== lastSeenVideoId) {
        lastSeenVideoId = vidId;
        const cur = document.title;
        if (!isOurTitle(cur)) originalTitle = cur;
      }
  
      // Bỏ qua cập nhật cho livestream, giữ nguyên tiêu đề mặc định của YouTube
      if (isLiveLabelVisibleOnControls()) {
        if (!isOurTitle(document.title)) {
          // đã là tiêu đề gốc, giữ nguyên
        } else {
          document.title = originalTitle;
        }
        return;
      }

      if (!video) {
        document.title = originalTitle;
        return;
      }
  
      const duration = video.duration;
      const currentTime = video.currentTime;
      const playbackRate = video.playbackRate || 1;
  
      if (!isFinite(duration) || duration <= 0) {
        document.title = originalTitle;
        return;
      }
  
      const remaining = Math.max(0, duration - currentTime);
      const remainingStr = formatSeconds(remaining);
  
      const newTitle = (Math.abs(playbackRate - 1) > 0.001)
        ? `${playbackRate.toFixed(2)}x - ${remainingStr} - ${originalTitle}`
        : `${remainingStr} - ${originalTitle}`;
  
      if (document.title !== newTitle) document.title = newTitle;
    }
  
    function startInterval() {
      if (intervalHandle) return;
      intervalHandle = setInterval(updateTitle, UPDATE_INTERVAL_MS);
      updateTitle();
    }
  
    function stopInterval() {
      if (!intervalHandle) return;
      clearInterval(intervalHandle);
      intervalHandle = null;
      document.title = originalTitle;
    }
  
    // Theo dõi thay đổi URL trong YouTube SPA
    let lastUrl = location.href;
    const urlCheckInterval = setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        const cur = document.title;
        if (!isOurTitle(cur)) originalTitle = cur;
      }
    }, 1000);
  
    // Theo dõi thay đổi tiêu đề gốc do YouTube cập nhật
    const titleEl = document.querySelector('title');
    if (titleEl && typeof MutationObserver !== 'undefined') {
      titleObserver = new MutationObserver(() => {
        const cur = document.title;
        if (!isOurTitle(cur)) {
          originalTitle = cur;
        }
      });
      titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }

    startInterval();
  
    window.addEventListener('unload', () => {
      stopInterval();
      clearInterval(urlCheckInterval);
      if (titleObserver) {
        try { titleObserver.disconnect(); } catch (_) {}
        titleObserver = null;
      }
    });
  })();