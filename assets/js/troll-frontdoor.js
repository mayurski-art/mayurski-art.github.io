/* Cross-site links, rewritten to same-origin paths — but only once the
   front door is actually serving this page.

   Native cross-document view transitions require both documents to share an
   origin. Every cross-site link on this network is an absolute subdomain URL
   (https://terminal.trollrunner.net), which is cross-origin and therefore
   kills the transition. The fix is to link to /terminal instead.

   The catch is that /terminal only exists behind the front door. On the
   GitHub Pages apex it is a 404, and the apex is what trollrunner.net serves
   today — so hard-coding paths would break every cross-site link until DNS
   moves. Both states live at the same hostname, so they cannot be told apart
   by name.

   So this asks. The front door serves /__frontdoor.json; nothing else does.
   If the probe fails for any reason the links are left exactly as they are,
   which is the current, working behaviour. It fails closed on purpose: the
   worst case is no transition, never a broken link.

   Load it anywhere. It is inert until the cutover, then turns itself on. */
(() => {
  'use strict';

  var PROBE = '/__frontdoor.json';
  var CACHE_KEY = 'trollrunner_frontdoor_v1';

  // Only subdomains the front door actually routes. Anything else keeps its
  // absolute URL — an unrouted path would 404, which is worse than no
  // transition. Kept in sync with frontdoor/vercel.json by hand.
  var ROUTED = ['terminal', 'finance', 'stickers'];

  // Static sites resolve their assets relatively, so they must land on the
  // trailing slash or every asset resolves a level too high. Next.js apps
  // are root-absolute and must not get one.
  var NEEDS_SLASH = { finance: 1, stickers: 1 };

  function pathFor(host) {
    var m = /^([a-z0-9-]+)\.trollrunner\.net$/i.exec(host);
    if (!m) return null;
    var sub = m[1].toLowerCase();
    if (ROUTED.indexOf(sub) === -1) return null;
    return '/' + sub + (NEEDS_SLASH[sub] ? '/' : '');
  }

  function rewriteAll(root) {
    var links = (root || document).querySelectorAll('a[href^="https://"]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var url;
      try { url = new URL(a.href); } catch (e) { continue; }
      var base = pathFor(url.host);
      if (!base) continue;
      // Preserve whatever the link pointed at within the site.
      var rest = url.pathname === '/' ? '' : url.pathname.replace(/^\//, '');
      a.href = base + rest + url.search + url.hash;
      a.removeAttribute('target');
    }
  }

  function activate() {
    rewriteAll(document);
    // Several of these pages build their UI after load, so catch late links
    // too rather than only the ones present at parse time.
    if (window.MutationObserver) {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          for (var j = 0; j < muts[i].addedNodes.length; j++) {
            var n = muts[i].addedNodes[j];
            if (n.nodeType === 1) rewriteAll(n);
          }
        }
      }).observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  var cached = null;
  try { cached = sessionStorage.getItem(CACHE_KEY); } catch (e) { /* private mode */ }

  if (cached === '1') { activate(); return; }
  if (cached === '0') return;

  // One probe per session. HEAD so it costs almost nothing.
  fetch(PROBE, { method: 'HEAD' })
    .then(function (r) {
      var on = r.ok ? '1' : '0';
      try { sessionStorage.setItem(CACHE_KEY, on); } catch (e) {}
      if (r.ok) activate();
    })
    .catch(function () {
      try { sessionStorage.setItem(CACHE_KEY, '0'); } catch (e) {}
    });
})();
