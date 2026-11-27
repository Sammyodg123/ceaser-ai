/* CEASER AI — interaction guardrails.
   The public landing page uses the browser's native document scroll.
   The authenticated chat shell is fixed; only its intentional inner panes scroll. */
(function () {
  'use strict';
  if (document.documentElement.classList.contains('page-scroll')) return;

  var startY = 0;
  function scrollParent(node) {
    for (var el = node; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      var style = getComputedStyle(el);
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1) return el;
    }
    return null;
  }

  document.addEventListener('touchstart', function (event) {
    if (event.touches.length === 1) startY = event.touches[0].clientY;
  }, { passive: true });

  // Never cancel a landing-page gesture. In chat, cancel only an attempted
  // overscroll at the edge of a real inner scroller to prevent rubber-banding.
  document.addEventListener('touchmove', function (event) {
    if (event.touches.length !== 1) return;
    var pane = scrollParent(event.target);
    if (!pane) return;
    var delta = event.touches[0].clientY - startY;
    var atTop = pane.scrollTop <= 0;
    var atBottom = pane.scrollTop + pane.clientHeight >= pane.scrollHeight - 1;
    if ((atTop && delta > 0) || (atBottom && delta < 0)) event.preventDefault();
  }, { passive: false });
})();
