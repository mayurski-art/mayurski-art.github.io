// The tab icon does trolltruths.com's move (trollrunner-terminal
// components/AnimatedFavicon.tsx): a horizontal spin that swaps grin <-> sad
// while edge-on. Browsers only play animated GIF favicons in Firefox, so
// frames are drawn to a canvas and pushed into a <link rel="icon"> of our own
// (the last icon link wins). The page's static grin icon stays wherever this
// doesn't run.
(function () {
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var FACE_GRIN = "/assets/images/icons/favicon/grin.png";
  var FACE_SAD = "/assets/images/icons/favicon/sad.png";
  var SIZE = 64;
  var SPIN_MS = 400;
  var FRAME_MS = 40;
  var HOLD_MS = 1600; // gap between the start of one spin and the next

  var canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;
  var link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/png";

  function load(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }

  // squash = cos(spin angle): 1 is face-on, 0 is edge-on.
  function draw(img, squash) {
    var scale = Math.min(SIZE / img.width, SIZE / img.height);
    var w = img.width * scale * Math.max(squash, 0.04);
    var h = img.height * scale;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
    link.href = canvas.toDataURL("image/png");
  }

  Promise.all([load(FACE_GRIN), load(FACE_SAD)]).then(function (faces) {
    var grin = faces[0], sad = faces[1];
    document.head.appendChild(link);
    var showingGrin = true;
    draw(grin, 1);

    function spin(start) {
      // Background tabs throttle timers to ~1/s, which would drag a spin out
      // over ten seconds, so just swap faces there instead.
      if (document.hidden) {
        showingGrin = !showingGrin;
        draw(showingGrin ? grin : sad, 1);
        setTimeout(function () { spin(performance.now()); }, HOLD_MS);
        return;
      }
      var t = Math.min((performance.now() - start) / SPIN_MS, 1);
      var from = showingGrin ? grin : sad;
      var to = showingGrin ? sad : grin;
      draw(t < 0.5 ? from : to, Math.abs(Math.cos(t * Math.PI)));
      if (t < 1) {
        setTimeout(function () { spin(start); }, FRAME_MS);
      } else {
        showingGrin = !showingGrin;
        setTimeout(function () { spin(performance.now()); }, HOLD_MS - SPIN_MS);
      }
    }
    setTimeout(function () { spin(performance.now()); }, HOLD_MS);
  }).catch(function () {});
})();
