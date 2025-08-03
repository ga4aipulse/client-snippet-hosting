(function () {
  const config = {
    endpoint: 'https://trackwebvital-957239900505.us-central1.run.app',
    errorEndpoint: 'https://trackwebvital-957239900505.us-central1.run.app/error',
    snippetVersion: 'v2.1.1',
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
      sessionStorage.setItem('__sessionStart__', Date.now());
    }
    return sessionStorage.getItem('__sessionId__');
  }

  function getGA4SessionId() {
    const ga4Cookie = document.cookie.match(/_ga_([A-Z0-9]+)=GS1\.1\.([^;]+)/);
    if (ga4Cookie) {
      const sessionData = ga4Cookie[2].split('.');
      if (sessionData.length >= 2) return sessionData[1];
    }
    const dataLayer = window.dataLayer || [];
    for (let i = dataLayer.length - 1; i >= 0; i--) {
      const item = dataLayer[i];
      if (item && (item.event === 'page_view' || item.event === 'gtm.js' || item.event === 'config') && item['ga4_session_id']) {
        return item['ga4_session_id'];
      }
    }
    if (window.google_tag_data?.tidr?.sid) {
      return window.google_tag_data.tidr.sid;
    }
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

  function getConsentStatus() {
    const dataLayer = window.dataLayer || [];
    for (let i = dataLayer.length - 1; i >= 0; i--) {
      const item = dataLayer[i];
      if (item && item.event === 'consent' && item.analytics_storage) {
        return item.analytics_storage;
      }
    }
    return document.cookie.includes('cookie_consent=granted') ? 'granted' : 'denied';
  }

  function getConnectionSpeed() {
    return navigator.connection?.downlink || 'unknown';
  }

  function getServerTiming() {
    try {
      const nav = performance.getEntriesByType('navigation')[0];
      const serverTiming = nav.serverTiming || [];
      return serverTiming.reduce((acc, timing) => {
        acc[timing.name] = timing.duration;
        return acc;
      }, {});
    } catch {
      return {};
    }
  }

  function getPageLoadTime() {
    try {
      const timing = performance.timing;
      return timing.loadEventEnd - timing.navigationStart || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  function getSessionDuration() {
    const start = sessionStorage.getItem('__sessionStart__') || (sessionStorage.setItem('__sessionStart__', Date.now()), Date.now());
    return Date.now() - parseInt(start);
  }

  function getEnvironment() {
    const hostname = location.hostname;
    if (hostname.includes('localhost') || hostname.includes('dev')) return 'development';
    if (hostname.includes('staging')) return 'staging';
    return 'production';
  }

  function getCustomDimensions() {
    const dataLayer = window.dataLayer || [];
    for (let i = dataLayer.length - 1; i >= 0; i--) {
      const item = dataLayer[i];
      if (item && item.custom) return item.custom;
    }
    return {};
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

  // ---------- Additional Metrics ----------
  function getFirstInteractionTime() {
    try {
      const entries = performance.getEntriesByType('event');
      const firstInteraction = entries.find(e => e.interactionId);
      return firstInteraction ? { name: 'FirstInteraction', value: firstInteraction.startTime, delta: firstInteraction.startTime, rating: 'none', timestamp: Date.now() } : null;
    } catch {
      return null;
    }
  }

  function trackScrollDepth() {
    let maxScroll = 0;
    window.addEventListener('scroll', () => {
      const scrollPercent = Math.min(100, Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100));
      if (scrollPercent > maxScroll) {
        maxScroll = scrollPercent;
        sendToServer({ name: 'ScrollDepth', value: scrollPercent, delta: scrollPercent, rating: 'none', timestamp: Date.now() });
      }
    }, { passive: true });
  }

  // ---------- Send ----------
  async function sendToServer(metric) {
    if (getConsentStatus() !== 'granted' || navigator.doNotTrack === '1') return;
    if (!metric || !metric.name || typeof metric.value !== 'number') {
      logErrorToServer(new Error(`Invalid metric data: ${JSON.stringify(metric)}`));
      return;
    }

    window.__webVitalsTracker.metricsBatch.push({
      name: metric.name,
      value: metric.value,
      delta: metric.delta,
      rating: metric.rating || 'none',
      timestamp: Date.now()
    });

    if (!window.__vitalsBatchTimeout) {
      window.__vitalsBatchTimeout = setTimeout(async () => {
        if (window.__webVitalsTracker.metricsBatch.length === 0) return;
        let attempts = 0;
        while (getGA4SessionId() === 'unknown' && attempts < 20 && window.dataLayer) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
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
          connectionSpeed: getConnectionSpeed(),
          deviceMemory: getDeviceMemory(),
          hardwareConcurrency: getCPUCores(),
          documentVisibility: document.visibilityState,
          navigationType: getNavigationType(),
          cookiesEnabled: navigator.cookieEnabled,
          isFirstVisit: isFirstVisit(),
          pageType: getPageType(),
          userType: getUserType(),
          consentStatus: getConsentStatus(),
          doNotTrack: navigator.doNotTrack === '1' ? true : false,
          pageLoadTime: getPageLoadTime(),
          sessionDuration: getSessionDuration(),
          environment: getEnvironment(),
          customDimensions: getCustomDimensions(),
          serverTiming: getServerTiming(),
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
        connectionSpeed: getConnectionSpeed(),
        deviceMemory: getDeviceMemory(),
        hardwareConcurrency: getCPUCores(),
        documentVisibility: document.visibilityState,
        navigationType: getNavigationType(),
        cookiesEnabled: navigator.cookieEnabled,
        isFirstVisit: isFirstVisit(),
        pageType: getPageType(),
        userType: getUserType(),
        consentStatus: getConsentStatus(),
        doNotTrack: navigator.doNotTrack === '1' ? true : false,
        pageLoadTime: getPageLoadTime(),
        sessionDuration: getSessionDuration(),
        environment: getEnvironment(),
        customDimensions: getCustomDimensions(),
        serverTiming: getServerTiming(),
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

  // ---------- Initialize Additional Metrics ----------
  document.addEventListener('click', () => {
    const metric = getFirstInteractionTime();
    if (metric) sendToServer(metric);
  }, { once: true });
  trackScrollDepth();

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
    webVitals.onFCP(sendToServer);
    // webVitals.onTBT(sendToServer); // Uncomment if supported
  };
  s.onerror = () => logErrorToServer(new Error('Error loading web-vitals script'));
  document.head.appendChild(s);
})();
