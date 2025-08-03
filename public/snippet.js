(function () {
  const config = {
    endpoint: 'https://trackwebvital-957239900505.us-central1.run.app',
    errorEndpoint: 'https://trackwebvital-957239900505.us-central1.run.app/error',
    snippetVersion: 'v2.1.0',
    webVitalsScript: 'https://unpkg.com/web-vitals@3/dist/web-vitals.iife.js',
    debug: false
  };

  window.__webVitalsTracker = window.__webVitalsTracker || { metricsBatch: [] };

  // ---------- Helpers ----------
  function getClientId() {
    var ga = document.cookie.match(/_ga=GA1\.1\.(\d+\.\d+)/);
    if (ga) return ga[1];
    var ga4 = document.cookie.match(/_ga_([A-Z0-9]+)=GS1\.1\.([^;]+)/);
    if (ga4) return ga4[2];
    return typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
  }

  function getSessionId() {
    if (!sessionStorage.getItem('__sessionId__')) {
      sessionStorage.setItem('__sessionId__', crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      }));
    }
    return sessionStorage.getItem('__sessionId__');
  }

  function getGA4SessionId() {
    // Try GA4 cookie (_ga_<measurement-id>)
    const ga4Cookie = document.cookie.match(/_ga_([A-Z0-9]+)=GS1\.1\.([^;]+)/);
    if (ga4Cookie) {
      const sessionData = ga4Cookie[2].split('.');
      if (sessionData.length >= 2) return sessionData[1];
    }

    // Try dataLayer (GTM or direct gtag.js)
    const dataLayer = window.dataLayer || [];
    for (let i = dataLayer.length - 1; i >= 0; i--) {
      const item = dataLayer[i];
      if (item && (item.event === 'page_view' || item.event === 'gtm.js' || item.event === 'config') && item['ga4_session_id']) {
        return item['ga4_session_id'];
      }
    }

    // Try gtag.js global object
    if (window.google_tag_data?.tidr?.sid) {
      return window.google_tag_data.tidr.sid;
    }

    // Try gtag.js config in dataLayer
    for (let i = dataLayer.length - 1; i >= 0; i--) {
      const item = dataLayer[i];
      if (item && item[0] === 'config' && item[1].startsWith('G-') && item[2]?.session_id) {
        return item[2].session_id;
      }
    }

    return 'unknown';
  }

  function getGA4MeasurementId() {
    const ga4Cookie = document.cookie.match(/_ga_([A-Z0-9]+)=GS1\.1\.([^;]+)/);
    if (ga4Cookie) return ga4Cookie[1];
    const dataLayer = window.dataLayer || [];
    for (let i = dataLayer.length - 1; i >= 0; i--) {
      const item = dataLayer[i];
      if (item && item[0] === 'config' && item[1].startsWith('G-')) {
        return item[1];
      }
    }
    return 'unknown';
  }

  function getPageType() {
    const dataLayer = window.dataLayer || [];
    for (let i = dataLayer.length - 1; i >= 0; i--) {
      const item = dataLayer[i];
      if (item && item.page_type) return item.page_type;
    }
    const path = location.pathname;
    if (path === '/' || path.includes('/home')) return 'home';
    if (path.includes('/product')) return 'product';
    if (path.includes('/checkout')) return 'checkout';
    return 'unknown';
  }

  function getUserType() {
    const dataLayer = window.dataLayer || [];
    for (let i = dataLayer.length - 1; i >= 0; i--) {
      const item = dataLayer[i];
      if (item && item.user_type) return item.user_type;
    }
    return document.cookie.includes('logged_in=true') ? 'logged-in' : 'anonymous';
  }

  async function getClientHints() {
    if (!navigator.userAgentData) return { deviceModel: 'unknown', platformVersion: 'unknown' };
    try {
      const hints = await navigator.userAgentData.getHighEntropyValues(['model', 'platformVersion']);
      return {
        deviceModel: hints.model || 'unknown',
        platformVersion: hints.platformVersion || 'unknown'
      };
    } catch {
      return { deviceModel: 'unknown', platformVersion: 'unknown' };
    }
  }

  function getSafeUrl() {
    const url = new URL(location.href);
    url.searchParams.delete('email');
    url.searchParams.delete('token');
    return url.toString();
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
      if (performance && performance.getEntriesByType) {
        return performance.getEntriesByType('navigation')[0]?.type || 'unknown';
      }
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  function getDeviceCategory() {
    const width = screen.width;
    const ua = navigator.userAgent;
    if (/Mobi/i.test(ua) || width < 768) return 'mobile';
    if (/Tablet|iPad/i.test(ua) || (width >= 768 && width <= 1024)) return 'tablet';
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

  function logErrorToServer(error) {
    if (config.debug) {
      console.error('Web Vitals error:', error);
      return;
    }
    try {
      navigator.sendBeacon(config.errorEndpoint, JSON.stringify({
        error: error.message,
        stack: error.stack,
        timestamp: Date.now(),
        page: getSafeUrl()
      }));
    } catch (e) {
      console.error('Failed to send error:', e);
    }
  }

  // ---------- Send ----------
  async function sendToServer(metric) {
    if (!metric || !metric.name || typeof metric.value !== 'number') {
      logErrorToServer(new Error(`Invalid metric data: ${JSON.stringify(metric)}`));
      return;
    }

    window.__webVitalsTracker.metricsBatch.push({
      name: metric.name,
      value: metric.value,
      delta: metric.delta,
      rating: metric.rating,
      timestamp: Date.now()
    });

    if (!window.__vitalsBatchTimeout) {
      window.__vitalsBatchTimeout = setTimeout(async () => {
        if (window.__webVitalsTracker.metricsBatch.length === 0) return;
        const uaInfo = parseUA();
        const clientHints = await getClientHints();
        const payload = {
          snippetVersion: config.snippetVersion,
          sessionId: getSessionId(),
          ga4SessionId: getGA4SessionId(),
          cid: getClientId(),
          ga4MeasurementId: getGA4MeasurementId(),
          page: getSafeUrl(),
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
          pageType: getPageType(),
          userType: getUserType(),
          clientHints: clientHints,
          metrics: window.__webVitalsTracker.metricsBatch,
          timestamp: Date.now()
        };

        if (config.debug) {
          console.log('Web Vitals payload:', payload);
          return;
        }

        try {
          navigator.sendBeacon(config.endpoint, JSON.stringify(payload));
        } catch (error) {
          logErrorToServer(error);
        }

        window.__webVitalsTracker.metricsBatch = [];
        window.__vitalsBatchTimeout = null;
      }, 1000);
    }
  }

  window.addEventListener('unload', () => {
    if (window.__webVitalsTracker.metricsBatch.length > 0) {
      const uaInfo = parseUA();
      const payload = {
        snippetVersion: config.snippetVersion,
        sessionId: getSessionId(),
        ga4SessionId: getGA4SessionId(),
        cid: getClientId(),
        ga4MeasurementId: getGA4MeasurementId(),
        page: getSafeUrl(),
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
        pageType: getPageType(),
        userType: getUserType(),
        clientHints: { deviceModel: 'unknown', platformVersion: 'unknown' },
        metrics: window.__webVitalsTracker.metricsBatch,
        timestamp: Date.now()
      };
      try {
        navigator.sendBeacon(config.endpoint, JSON.stringify(payload));
      } catch (error) {
        logErrorToServer(error);
      }
    }
  });

  // ---------- Load web-vitals ----------
  var s = document.createElement('script');
  s.src = config.webVitalsScript;
  s.async = true;
  s.onload = function () {
    if (typeof webVitals === 'undefined') {
      logErrorToServer(new Error('Failed to load web-vitals library'));
      return;
    }
    webVitals.onFID(sendToServer);
    webVitals.onLCP(sendToServer);
    webVitals.onCLS(sendToServer);
    webVitals.onINP(sendToServer);
    webVitals.onTTFB(sendToServer);
  };
  s.onerror = () => logErrorToServer(new Error('Error loading web-vitals script'));
  document.head.appendChild(s);
})();
