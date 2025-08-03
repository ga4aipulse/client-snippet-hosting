(function(){
  // 1. Global guard
  if (window.__CWV_ROLLUP_LOADED__) return;
  window.__CWV_ROLLUP_LOADED__ = true;

  try {
    // ---------- helpers (prefixed cwv_) ----------
    var cwv_round2 = function(num) {
      return (num == null || isNaN(num)) ? null : Math.round(num * 100) / 100;
    };

    var cwv_getClientId = function() {
      var ga = document.cookie.match(/_ga=GA1\.1\.(\d+\.\d+)/);
      if (ga) return ga[1];
      var ga4 = document.cookie.match(/_ga_([A-Z0-9]+)=GS1\.1\.([^;]+)/);
      if (ga4) return ga4[2];
      return (typeof crypto!=='undefined'&&crypto.randomUUID)?crypto.randomUUID():'';
    };
    var cwv_getSessionId = function() {
      if(!sessionStorage.getItem('__cwv_sessionId__')) {
        sessionStorage.setItem('__cwv_sessionId__',
          (typeof crypto!=='undefined'&&crypto.randomUUID)?crypto.randomUUID():''
        );
      }
      return sessionStorage.getItem('__cwv_sessionId__');
    };
    var cwv_isMobileDevice = function(){
      return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    };
    var cwv_getConnectionType = function(){
      var conn = navigator.connection||navigator.mozConnection||navigator.webkitConnection||{};
      return conn.effectiveType||'unknown';
    };
    var cwv_getDeviceMemory = function(){ return navigator.deviceMemory||'unknown'; };
    var cwv_getCPUCores   = function(){ return navigator.hardwareConcurrency||'unknown'; };
    var cwv_getViewport   = function(){ return window.innerWidth+'x'+window.innerHeight; };
    var cwv_getScreenResolution = function(){ return screen.width+'x'+screen.height; };
    var cwv_isFirstVisit = function(){
      if(!localStorage.getItem('__cwv_webVitalsSeen__')){
        localStorage.setItem('__cwv_webVitalsSeen__','1');
        return true;
      }
      return false;
    };
    var cwv_getNavigationType = function(){
      try {
        var nav = performance.getEntriesByType('navigation');
        return (nav&&nav[0]&&nav[0].type)||'unknown';
      } catch(e){ return 'unknown'; }
    };
    var cwv_getDeviceCategory = function(){
      var w=screen.width,ua=navigator.userAgent;
      if(/Mobi/i.test(ua)||w<768) return 'mobile';
      if(/Tablet|iPad/i.test(ua)||(w>=768&&w<=1024)) return 'tablet';
      return 'desktop';
    };
    var cwv_parseUA = function(){
      var ua=navigator.userAgent, os='unknown',m;
      if(/Windows NT/.test(ua)) os='Windows';
      else if(/Mac OS X/.test(ua)) os='macOS';
      else if(/Android/.test(ua)) os='Android';
      else if(/iPhone|iPad/.test(ua)) os='iOS';
      var name='unknown',ver='unknown';
      if((m=ua.match(/Chrome\/([\d.]+)/)))       { name='Chrome'; ver=m[1]; }
      else if(/Safari/.test(ua)&&(m=ua.match(/Version\/([\d.]+)/))) { name='Safari'; ver=m[1]; }
      else if((m=ua.match(/Firefox\/([\d.]+)/))) { name='Firefox'; ver=m[1]; }
      else if((m=ua.match(/Edg\/([\d.]+)/)))     { name='Edge';    ver=m[1]; }
      return {os:os,browserName:name,browserVersion:ver};
    };

    // ---------- aggregation & unsubscribers ----------
    var cwv_metricsBuffer   = {};
    var cwv_expectedMetrics = ['FID','LCP','CLS','INP','TTFB'];
    var cwv_unsubscribers   = [];

    var cwv_handleMetric = function(metric){
      cwv_metricsBuffer[metric.name] = {
        value: cwv_round2(metric.value),
        delta: cwv_round2(metric.delta),
        rating: metric.rating
      };
      // if we've got all five, send now
      var cnt=0; for(var k in cwv_metricsBuffer) if(cwv_metricsBuffer.hasOwnProperty(k))cnt++;
      if(cnt===cwv_expectedMetrics.length) cwv_sendAllMetrics();
    };

    // manually pull LCP/CLS from performance entries
    var cwv_manualFallbackMetrics = function(){
      // LCP
      if(!cwv_metricsBuffer.LCP){
        var lcp=performance.getEntriesByType('largest-contentful-paint');
        if(lcp&&lcp.length){
          var last=lcp[lcp.length-1],
              v=last.renderTime||last.loadTime,
              rv=cwv_round2(v),
              r=(v<=2500?'good':v<=4000?'needs-improvement':'poor');
          cwv_metricsBuffer.LCP={ value:rv, delta:rv, rating:r };
        }
      }
      // CLS
      if(!cwv_metricsBuffer.CLS){
        var shifts=performance.getEntriesByType('layout-shift'),
            sum=0,i;
        for(i=0;i<shifts.length;i++) sum+=shifts[i].value;
        var rs=cwv_round2(sum),
            r2=(sum<=0.1?'good':sum<=0.25?'needs-improvement':'poor');
        cwv_metricsBuffer.CLS={ value:rs, delta:rs, rating:r2 };
      }
      // INP left as not-collected if missing
    };

    var cwv_sendAllMetrics = function(){
      if(cwv_sendAllMetrics._sent) return;
      cwv_sendAllMetrics._sent=true;
      clearTimeout(cwv_fallbackTimer);
      for(var i=0;i<cwv_unsubscribers.length;i++){
        try { cwv_unsubscribers[i](); } catch(e){}
      }
      // fill missing placeholders
      for(i=0;i<cwv_expectedMetrics.length;i++){
        var nm=cwv_expectedMetrics[i];
        if(!cwv_metricsBuffer.hasOwnProperty(nm))
          cwv_metricsBuffer[nm]={ value:null, delta:null, rating:'not-collected' };
      }
      var uaInfo=cwv_parseUA(),
          payload={
            snippetVersion:'v2.1.0',
            sessionId:cwv_getSessionId(),
            cid:cwv_getClientId(),
            page:location.href,
            path:location.pathname,
            ua:navigator.userAgent,
            os:uaInfo.os,
            browserName:uaInfo.browserName,
            browserVersion:uaInfo.browserVersion,
            referrer:document.referrer||null,
            language:navigator.language,
            viewport:cwv_getViewport(),
            screenResolution:cwv_getScreenResolution(),
            platform:cwv_isMobileDevice()?'mobile':'desktop',
            deviceCategory:cwv_getDeviceCategory(),
            connection:cwv_getConnectionType(),
            deviceMemory:cwv_getDeviceMemory(),
            hardwareConcurrency:cwv_getCPUCores(),
            documentVisibility:document.visibilityState,
            navigationType:cwv_getNavigationType(),
            cookiesEnabled:navigator.cookieEnabled,
            isFirstVisit:cwv_isFirstVisit(),
            timestamp:Date.now(),
            metrics:cwv_metricsBuffer
          },
          url='https://us-central1-mythical-height-451619-v9.cloudfunctions.net/trackWebVitals',
          body=JSON.stringify(payload);
      if(navigator.sendBeacon) navigator.sendBeacon(url,body);
      else fetch(url,{ method:'POST',
                       headers:{'Content-Type':'application/json'},
                       keepalive:true, body:body });
    };

    // fallback after 15s
    var cwv_fallbackTimer=setTimeout(function(){
      if(!cwv_sendAllMetrics._sent){
        cwv_manualFallbackMetrics();
        cwv_sendAllMetrics();
      }
    },15000);

    // ---------- load web-vitals & wire up ----------
    var cwv_script=document.createElement('script');
    cwv_script.src='https://unpkg.com/web-vitals@3/dist/web-vitals.iife.js';
    cwv_script.onload=function(){
      cwv_unsubscribers.push(webVitals.onFID(cwv_handleMetric));
      cwv_unsubscribers.push(webVitals.onLCP(cwv_handleMetric));
      cwv_unsubscribers.push(webVitals.onCLS(cwv_handleMetric));
      cwv_unsubscribers.push(webVitals.onINP(cwv_handleMetric));
      cwv_unsubscribers.push(webVitals.onTTFB(cwv_handleMetric));
    };
    cwv_script.onerror=function(){
      cwv_manualFallbackMetrics();
      cwv_sendAllMetrics();
    };
    document.head.appendChild(cwv_script);

    // ---------- flush on unload/visibility ----------
    window.addEventListener('visibilitychange',function(){
      if(document.visibilityState==='hidden'){
        cwv_manualFallbackMetrics();
        cwv_sendAllMetrics();
      }
    });
    window.addEventListener('pagehide',function(){
      cwv_manualFallbackMetrics();
      cwv_sendAllMetrics();
    });

  } catch(e){
    // no-op to avoid conflicts
  }
})();
