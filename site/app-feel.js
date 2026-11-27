/* CEASER AI — native-app feel. The page itself never moves; only inner scrollers scroll, and they never hand the gesture to the page. */
(function () {
  var y0 = 0;
  function scroller(el) { // nearest ancestor that can really scroll vertically
    for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      var cs = getComputedStyle(el), oy = cs.overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) return el;
    }
    return null;
  }
  document.addEventListener('touchstart', function (e) { y0 = e.touches[0].clientY; }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    if (e.touches.length > 1) { e.preventDefault(); return; }           // no pinch zoom
    if (document.documentElement.classList.contains('page-scroll')) return; // landing page: let the browser scroll natively (this handler was what froze it)
    var t = e.target; if (t && t.closest && t.closest('textarea,input,[contenteditable]')) { var s0 = scroller(t); if (s0) return; }
    var s = scroller(t), dy = e.touches[0].clientY - y0;
    if (Math.abs(dy) < 10) return;                                      // finger jitter during a tap: never cancel it, or buttons stop clicking
    if (!s) { if (document.documentElement.classList.contains('page-scroll')) { var d = document.scrollingElement || document.documentElement; if ((d.scrollTop <= 0 && dy > 0) || (d.scrollTop + d.clientHeight >= d.scrollHeight - 1 && dy < 0)) e.preventDefault(); return; } e.preventDefault(); return; } // nothing scrollable here: swallow, so the page cannot bounce
    var top = s.scrollTop <= 0, bot = s.scrollTop + s.clientHeight >= s.scrollHeight - 1;
    if ((top && dy > 0) || (bot && dy < 0)) e.preventDefault();         // at the edge: stop rubber-band / pull-to-refresh
  }, { passive: false });
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (n) { document.addEventListener(n, function (e) { e.preventDefault(); }); });
  var last = 0; document.addEventListener('touchend', function (e) { if (document.documentElement.classList.contains('page-scroll')) return; var n = Date.now(); if (n - last < 300 && !(e.target.closest && e.target.closest('textarea,input,button,a,[role=button],.pop,.sheet,.tray'))) e.preventDefault(); last = n; }, { passive: false }); // no double-tap zoom
  document.addEventListener('contextmenu', function (e) { if (!(e.target.closest && e.target.closest('textarea,input,pre,code,.c'))) e.preventDefault(); });
})();
