(function () {
  // ---------- helpers ----------
  function getClientId() {
    // Try Universal Analytics _ga cookie
    var ga = document.cookie.match(/_ga=GA1\.1\.(\d+\.\d+)/);
    if (ga) return ga[1]; // Return only the core client ID (e.g., 123456789.987654321)
    // Try GA4 _ga_<container-id> cookie
    var ga4 = document.cookie.match(/_ga_([A-Z0-9]+)=GS1\.1\.([^;]+)/);
    if (ga4) return ga4[2];
    // Fallback to random UUID if no cookies are found
    return crypto.randomUUID();
  }

  function getSessionId() {
    if (!sessionStorage.getItem('__sessionId__')) {
      sessionStorage.setItem('__sessionId__', crypto.randomUUID());
    }
    return sessionStorage.getItem('__sessionId__');
  }

  function getGA4SessionId() {
    // Try GTM data layer first
    if (window.dataLayer) {
      for (let i = window.dataLayer.length - 1; i >= 0; i--) {
        const item = window.dataLayer[i];
        if (item && item.event === 'gtm.js' && item['gtm.start']) {
          return item['ga4_session_id'] || 'unknown';
        }
      }
    }
    // Fallback to gtag.js global object
    if (window.google_tag_data && window.google_tag_data.tidr) {
      return window.google_tag_data.tidr.sid || 'unknown';
    }
    return 'unknown';
  }

  function isMobileDevice() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function getConnectionType() {
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
    return conn.effectiveType || 'unknown';
  }

  function getDeviceMemory() {
    return navigator.deviceMemory || 'unknown';
  }

  function getCPUCores() {
    return navigator.hardwareConcurrency || 'unknown';
  }

  function getScreenResolution() {
    return screen.width + 'x' + screen.height;
  }

  function getViewport() {
    return window.innerWidth + 'x' + window.innerHeight;
  }

  function isFirstVisit() {
    if (!localStorage.getItem('__webVitalsSeen__')) {
      localStorage.setItem('__webVitalsSeen__', '1');
      return true;
    }
    return false;
  }

  function getNavigationType() {
    try {
      return performance.getEntriesByType('navigation')[0]?.type || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  function getDeviceCategory() {
    const width = screen.width;
    const ua = navigator.userAgent;

    if (/Mobi/i.test(ua) || width < 768) {
      return 'mobile';
    }
    if (/Tablet|iPad/i.test(ua) || (width >= 768 && width <= 1024)) {
      return 'tablet';
    }
    return 'desktop';
  }

  function parseUA() {
    const ua = navigator.userAgent;
    let os = 'unknown', browserName = 'unknown', browserVersion = 'unknown';

    if (/Windows NT/.test(ua)) os = 'Windows';
    else if (/Mac OS X/.test(ua)) os = 'macOS';
    else if (/Android/.test(ua)) os = 'Android';
    else if (/iPhone|iPad/.test(ua)) os = 'iOS';

    if (/Chrome\/(\d+)/.test(ua)) {
      browserName = 'Chrome';
      browserVersion = ua.match(/Chrome\/([\d.]+)/)?.[1] || 'unknown';
    } else if (/Safari/.test(ua) && /Version\/([\d.]+)/.test(ua)) {
      browserName = 'Safari';
      browserVersion = ua.match(/Version\/([\d.]+)/)?.[1] || 'unknown';
    } else if (/Firefox\/(\d+)/.test(ua)) {
      browserName = 'Firefox';
      browserVersion = ua.match(/Firefox\/([\d.]+)/)?.[1] || 'unknown';
    } else if (/Edg\/(\d+)/.test(ua)) {
      browserName = 'Edge';
      browserVersion = ua.match(/Edg\/([\d.]+)/)?.[1] || 'unknown';
    }

    return { os, browserName, browserVersion };
  }

  // ---------- send ----------
  function sendToServer(metric) {
    const uaInfo = parseUA();

    fetch('https://trackwebvital-957239900505.us-central1.run.app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        snippetVersion: 'v2.1.0',
        sessionId: getSessionId(),
        ga4SessionId: getGA4SessionId(),
        cid: getClientId(),
        name: metric.name,
        value: metric.value,
        delta: metric.delta,
        rating: metric.rating,
        page: location.href,
        path: location.pathname,
        ua: navigator.userAgent,
        os: uaInfo.os,
        browserName: uaInfo.browserName,
        browserVersion: uaInfo.browserVersion,
        referrer: document.referrer || null,
        language: navigator.language,
        viewport: getViewport(),
        screenResolution: getScreenResolution(),
        platform: isMobileDevice() ? 'mobile' : 'desktop',
        deviceCategory: getDeviceCategory(),
        connection: getConnectionType(),
        deviceMemory: getDeviceMemory(),
        hardwareConcurrency: getCPUCores(),
        documentVisibility: document.visibilityState,
        navigationType: getNavigationType(),
        cookiesEnabled: navigator.cookieEnabled,
        isFirstVisit: isFirstVisit(),
        timestamp: Date.now()
      })
    });
  }

  // ---------- load web-vitals ----------
  var s = document.createElement('script');
  s.src = 'https://unpkg.com/web-vitals@3/dist/web-vitals.iife.js';
  s.onload = function () {
    webVitals.onFID(sendToServer);
    webVitals.onLCP(sendToServer);
    webVitals.onCLS(sendToServer);
    webVitals.onINP(sendToServer);
    webVitals.onTTFB(sendToServer);
  };
  document.head.appendChild(s);
})();
