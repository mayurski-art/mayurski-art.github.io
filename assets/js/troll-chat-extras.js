/* ============================================================================
   TROLLCHAT EXTRAS — GIF pack + PictoChat-style drawing pad
   ----------------------------------------------------------------------------
   Shared by the homepage widget (index.html) and the standalone room
   (chat.html). Both surfaces speak the same message protocol over the one
   Realtime channel + troll_chat table:

     plain text : body = "hello"                          (unchanged)
     GIF        : body = "gif:<token>"                    (token from GIF pack)
     drawing    : body = "draw:data:image/png;base64,..." (needs troll_chat_v2.sql
                                                           to persist; live-only
                                                           until that runs)

   GIF bodies stay under the original 240-char insert policy, so they save to
   history with zero DB changes. Everything renders through DOM APIs — no
   user-controlled innerHTML — and drawing/GIF sources are validated against
   a strict allowlist/regex before ever touching an <img src>.
   ========================================================================== */
(function () {
  'use strict';

  var GIFS = {
    grin:     { src: 'assets/animations/troll-grin.gif', label: 'grin' },
    lel:      { src: 'assets/animations/troll-lel_transparent.gif', label: 'lel' },
    love:     { src: 'assets/animations/troll-love.gif', label: 'troll love' },
    computer: { src: 'assets/animations/troll-computer.gif', label: 'problem?' },
    typer:    { src: 'assets/animations/troll-typer.gif', label: 'keyboard troll' },
    warrior:  { src: 'assets/animations/Keyboard Warrior 2025.gif', label: 'keyboard warrior' },
    forward:  { src: 'assets/animations/forward.gif', label: 'onward' },
  };

  var TEXT_MAX = 240;
  var DRAW_MAX = 32000; // must match the char_length cap in troll_chat_v2.sql
  var DRAW_RE = /^draw:data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;

  var PAPER = '#fbfdf2';
  var COLORS = [
    ['ink', '#14231d'], ['green', '#2bd66f'], ['teal', '#2fb3a6'],
    ['yellow', '#f4d35e'], ['pink', '#ff5ec1'], ['red', '#ff2d3d'],
    ['blue', '#1565c0'], ['brown', '#5d4037'],
  ];
  var SIZES = [['S', 2], ['M', 5], ['L', 10]];
  var CANVAS_W = 224, CANVAS_H = 144, UNDO_MAX = 12;

  function bodyCap(text) {
    return String(text || '').indexOf('draw:') === 0 ? DRAW_MAX : TEXT_MAX;
  }

  function parseBody(text) {
    var t = String(text || '');
    if (t.indexOf('gif:') === 0) {
      var g = GIFS[t.slice(4).trim()];
      if (g) return { kind: 'gif', src: g.src, label: g.label };
    }
    if (t.indexOf('draw:') === 0 && t.length <= DRAW_MAX && DRAW_RE.test(t)) {
      return { kind: 'draw', src: t.slice(5) };
    }
    return { kind: 'text', text: t };
  }

  /* Fill a message-body element: an <img> for gif/draw messages, plain
     textContent otherwise. Returns true when media was rendered. */
  function renderBodyInto(el, text) {
    var p = parseBody(text);
    if (p.kind === 'gif' || p.kind === 'draw') {
      var img = document.createElement('img');
      img.className = 'tcx-media' + (p.kind === 'draw' ? ' tcx-media--draw' : '');
      img.src = p.src;
      img.alt = p.kind === 'gif' ? p.label + ' gif' : 'drawing';
      img.loading = 'lazy';
      img.draggable = false;
      el.appendChild(img);
      return true;
    }
    el.textContent = p.text;
    return false;
  }

  /* ---------- styles (injected once; both pages load the same fonts) ------ */
  var CSS = [
    'form.tcx-host { grid-template-columns: minmax(78px, 118px) minmax(0, 1fr) auto auto auto; }',
    '@media (max-width: 720px) { form.tcx-host { grid-template-columns: minmax(58px, 82px) minmax(0, 1fr) auto auto auto; gap: 5px; } }',
    '.tcx-btn { border: 3px solid #10201a; border-radius: 3px; background: linear-gradient(180deg, #eafff1, #bfe9cf); color: #143524; padding: 7px 7px; font-family: "Press Start 2P","VT323",monospace; font-size: 9px; line-height: 1; cursor: pointer; box-shadow: 3px 3px 0 #10201a; }',
    '.tcx-btn:hover { background: linear-gradient(180deg, #f6fff9, #d3f2dd); }',
    '.tcx-btn:active { transform: translate(3px, 3px); box-shadow: 0 0 0 #10201a; }',
    '.tcx-media { display: block; margin-top: 5px; max-width: min(100%, 200px); height: auto; border: 2px solid #10201a; border-radius: 3px; background: #fff; box-shadow: 2px 2px 0 rgba(16,32,26,0.35); }',
    '.tcx-media--draw { max-width: min(100%, 280px); background: #fbfdf2; image-rendering: pixelated; }',
    '.tcx-overlay { position: fixed; inset: 0; z-index: 12000; display: grid; place-items: center; padding: 16px; background: rgba(8, 14, 11, 0.62); }',
    '.tcx-overlay[hidden] { display: none; }',
    '.tcx-modal { width: min(92vw, 380px); max-height: 92vh; overflow-y: auto; border: 3px solid #10201a; border-radius: 4px; background: linear-gradient(180deg, #f3f8e9, #d7e7cf); box-shadow: 0 0 0 3px #cfe3cd, 0 0 0 6px #10201a, 10px 10px 0 6px rgba(0,0,0,0.45); padding: 10px; font-family: "VT323","DM Mono",monospace; color: #14231d; display: grid; gap: 8px; }',
    '.tcx-modal--pad { width: min(92vw, 480px); }',
    '.tcx-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; border: 3px solid #10201a; border-radius: 3px; padding: 6px 8px; background: linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 45%), linear-gradient(90deg, #2bd66f, #2fb3a6 60%, #f4d35e); }',
    '.tcx-title { font-family: "Press Start 2P","VT323",monospace; font-size: 10px; color: #0c1a12; text-shadow: 1px 1px 0 rgba(255,255,255,0.5); }',
    '.tcx-x { border: 2px solid #10201a; border-radius: 2px; background: #fff; width: 24px; height: 24px; padding: 0; font: 14px "VT323",monospace; line-height: 1; cursor: pointer; color: #14231d; }',
    '.tcx-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; }',
    '.tcx-gif { display: grid; gap: 4px; justify-items: center; border: 2px solid #10201a; border-radius: 3px; background: #fbfdf2; padding: 6px; cursor: pointer; font: 14px "VT323",monospace; color: #2a4636; }',
    '.tcx-gif:hover, .tcx-gif:focus-visible { background: #fff; border-color: #2fb3a6; outline: none; }',
    '.tcx-gif img { width: 100%; height: 64px; object-fit: contain; }',
    '.tcx-canvas { width: 100%; height: auto; aspect-ratio: 224 / 144; border: 3px solid #10201a; border-radius: 3px; background: #fbfdf2; touch-action: none; cursor: crosshair; image-rendering: pixelated; display: block; }',
    '.tcx-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }',
    '.tcx-swatch { width: 26px; height: 26px; border: 2px solid #10201a; border-radius: 3px; cursor: pointer; padding: 0; }',
    '.tcx-swatch[aria-pressed="true"] { outline: 3px solid #ff5ec1; outline-offset: 1px; }',
    '.tcx-tool { border: 2px solid #10201a; border-radius: 3px; background: #fbfdf2; padding: 6px 8px; font-family: "Press Start 2P","VT323",monospace; font-size: 8px; cursor: pointer; box-shadow: 2px 2px 0 #10201a; color: #143524; }',
    '.tcx-tool[aria-pressed="true"] { background: #f4d35e; }',
    '.tcx-tool:active { transform: translate(2px, 2px); box-shadow: 0 0 0 #10201a; }',
    '.tcx-note { min-height: 16px; font-size: 15px; line-height: 1.15; color: #5a6f5e; }',
    '.tcx-actions { justify-content: flex-end; }',
    '.tcx-cancel, .tcx-submit { border: 3px solid #10201a; border-radius: 3px; padding: 8px 12px; font-family: "Press Start 2P","VT323",monospace; font-size: 9px; cursor: pointer; box-shadow: 3px 3px 0 #10201a; }',
    '.tcx-cancel { background: #fbfdf2; color: #143524; }',
    '.tcx-submit { background: linear-gradient(180deg, #ffe27a, #f4d35e); color: #1a1306; }',
    '.tcx-cancel:active, .tcx-submit:active { transform: translate(3px, 3px); box-shadow: 0 0 0 #10201a; }',
  ].join('\n');

  function injectCss() {
    if (document.getElementById('tcx-style')) return;
    var style = document.createElement('style');
    style.id = 'tcx-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  /* ---------- modal plumbing --------------------------------------------- */
  function wireModalChrome(overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal(overlay);
    });
    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); closeModal(overlay); }
    });
    var x = overlay.querySelector('.tcx-x');
    if (x) x.addEventListener('click', function () { closeModal(overlay); });
  }

  function openModal(overlay, trigger) {
    overlay.hidden = false;
    overlay._tcxTrigger = trigger || null;
    var first = overlay.querySelector('.tcx-focus-first') || overlay.querySelector('button');
    if (first) first.focus();
  }

  function closeModal(overlay) {
    overlay.hidden = true;
    var t = overlay._tcxTrigger;
    if (t && typeof t.focus === 'function') t.focus();
  }

  /* ---------- GIF tray ---------------------------------------------------- */
  function buildTray(send) {
    var overlay = document.createElement('div');
    overlay.className = 'tcx-overlay';
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="tcx-modal" role="dialog" aria-modal="true" aria-label="GIF pack">' +
        '<div class="tcx-head"><span class="tcx-title">GIF PACK</span>' +
        '<button type="button" class="tcx-x" aria-label="Close GIF pack">&#x2715;</button></div>' +
        '<div class="tcx-grid"></div>' +
        '<div class="tcx-note" aria-live="polite"></div>' +
      '</div>';
    var grid = overlay.querySelector('.tcx-grid');
    var note = overlay.querySelector('.tcx-note');
    Object.keys(GIFS).forEach(function (token, i) {
      var g = GIFS[token];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tcx-gif' + (i === 0 ? ' tcx-focus-first' : '');
      b.setAttribute('aria-label', 'Send the ' + g.label + ' GIF');
      var img = document.createElement('img');
      img.src = g.src; img.alt = ''; img.loading = 'lazy';
      var cap = document.createElement('span');
      cap.textContent = g.label;
      b.appendChild(img); b.appendChild(cap);
      b.addEventListener('click', function () {
        Promise.resolve(send('gif:' + token)).then(function (ok) {
          if (ok) closeModal(overlay);
          else note.textContent = 'hold up — try again in a sec.';
        });
      });
      grid.appendChild(b);
    });
    wireModalChrome(overlay);
    document.body.appendChild(overlay);
    return overlay;
  }

  /* ---------- drawing pad ------------------------------------------------- */
  function buildPad(send) {
    var overlay = document.createElement('div');
    overlay.className = 'tcx-overlay';
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="tcx-modal tcx-modal--pad" role="dialog" aria-modal="true" aria-label="Drawing pad">' +
        '<div class="tcx-head"><span class="tcx-title">&#x270E; TROLLDRAW</span>' +
        '<button type="button" class="tcx-x" aria-label="Close drawing pad">&#x2715;</button></div>' +
        '<canvas class="tcx-canvas" width="' + CANVAS_W + '" height="' + CANVAS_H + '" ' +
          'aria-label="Drawing canvas. Draw with your mouse or finger."></canvas>' +
        '<div class="tcx-row tcx-colors" role="group" aria-label="Pen color"></div>' +
        '<div class="tcx-row tcx-tools" role="group" aria-label="Pen size and tools"></div>' +
        '<div class="tcx-note" aria-live="polite"></div>' +
        '<div class="tcx-row tcx-actions">' +
          '<button type="button" class="tcx-cancel">CANCEL</button>' +
          '<button type="button" class="tcx-submit tcx-focus-first">SEND &#x25B8;</button>' +
        '</div>' +
      '</div>';

    var canvas = overlay.querySelector('.tcx-canvas');
    var ctx = canvas.getContext('2d');
    var note = overlay.querySelector('.tcx-note');
    var colorsRow = overlay.querySelector('.tcx-colors');
    var toolsRow = overlay.querySelector('.tcx-tools');

    var color = COLORS[0][1];
    var size = SIZES[1][1];
    var erasing = false;
    var drawing = false;
    var dirty = false;
    var last = null;
    var undoStack = [];

    function setNote(msg) { note.textContent = msg || ''; }

    function clearCanvas() {
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      undoStack.length = 0;
      dirty = false;
    }
    clearCanvas();

    function pressGroup(row, btn) {
      Array.prototype.forEach.call(row.children, function (c) {
        if (c.dataset.tcxGroup === btn.dataset.tcxGroup) c.setAttribute('aria-pressed', c === btn ? 'true' : 'false');
      });
    }

    var eraseBtn; // forward ref so color picks can un-press it
    COLORS.forEach(function (entry, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tcx-swatch';
      b.dataset.tcxGroup = 'color';
      b.style.background = entry[1];
      b.setAttribute('aria-label', entry[0] + ' pen');
      b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
      b.addEventListener('click', function () {
        color = entry[1];
        erasing = false;
        if (eraseBtn) eraseBtn.setAttribute('aria-pressed', 'false');
        pressGroup(colorsRow, b);
      });
      colorsRow.appendChild(b);
    });

    SIZES.forEach(function (entry, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tcx-tool';
      b.dataset.tcxGroup = 'size';
      b.textContent = entry[0];
      b.setAttribute('aria-label', 'Pen size ' + entry[0]);
      b.setAttribute('aria-pressed', i === 1 ? 'true' : 'false');
      b.addEventListener('click', function () {
        size = entry[1];
        pressGroup(toolsRow, b);
      });
      toolsRow.appendChild(b);
    });

    eraseBtn = document.createElement('button');
    eraseBtn.type = 'button';
    eraseBtn.className = 'tcx-tool';
    eraseBtn.textContent = 'ERASE';
    eraseBtn.setAttribute('aria-pressed', 'false');
    eraseBtn.addEventListener('click', function () {
      erasing = !erasing;
      eraseBtn.setAttribute('aria-pressed', erasing ? 'true' : 'false');
    });
    toolsRow.appendChild(eraseBtn);

    var undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.className = 'tcx-tool';
    undoBtn.textContent = 'UNDO';
    undoBtn.addEventListener('click', function () {
      var im = undoStack.pop();
      if (im) ctx.putImageData(im, 0, 0);
      if (!undoStack.length) dirty = false;
    });
    toolsRow.appendChild(undoBtn);

    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'tcx-tool';
    clearBtn.textContent = 'CLEAR';
    clearBtn.addEventListener('click', function () { clearCanvas(); setNote(''); });
    toolsRow.appendChild(clearBtn);

    function pos(e) {
      var r = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * (CANVAS_W / r.width),
        y: (e.clientY - r.top) * (CANVAS_H / r.height),
      };
    }

    function stroke(from, to) {
      ctx.strokeStyle = erasing ? PAPER : color;
      ctx.lineWidth = size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }

    canvas.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      if (undoStack.length >= UNDO_MAX) undoStack.shift();
      undoStack.push(ctx.getImageData(0, 0, CANVAS_W, CANVAS_H));
      drawing = true;
      dirty = true;
      last = pos(e);
      stroke(last, { x: last.x + 0.01, y: last.y + 0.01 }); // a tap leaves a dot
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drawing) return;
      e.preventDefault();
      var p = pos(e);
      stroke(last, p);
      last = p;
    });
    ['pointerup', 'pointercancel'].forEach(function (type) {
      canvas.addEventListener(type, function () { drawing = false; });
    });

    overlay.querySelector('.tcx-cancel').addEventListener('click', function () { closeModal(overlay); });
    overlay.querySelector('.tcx-submit').addEventListener('click', function () {
      if (!dirty) { setNote('draw something first!'); return; }
      var data;
      try { data = canvas.toDataURL('image/png'); } catch (err) { setNote('could not export the drawing.'); return; }
      var body = 'draw:' + data;
      if (body.length > DRAW_MAX) { setNote('too much detail — erase a little.'); return; }
      Promise.resolve(send(body)).then(function (ok) {
        if (!ok) { setNote('hold up — try again in a sec.'); return; }
        setNote('');
        clearCanvas();
        closeModal(overlay);
      });
    });

    wireModalChrome(overlay);
    document.body.appendChild(overlay);
    return overlay;
  }

  /* ---------- composer hookup --------------------------------------------
     attachComposer({ form, send })
       form : the chat composer <form> (buttons are inserted before SEND)
       send : page send fn — takes the body string, resolves true when sent */
  function attachComposer(opts) {
    var form = opts && opts.form;
    var send = opts && opts.send;
    if (!form || typeof send !== 'function' || form.dataset.tcxAttached) return;
    form.dataset.tcxAttached = '1';
    injectCss();
    form.classList.add('tcx-host');

    var submitBtn = form.querySelector('button[type="submit"]');
    var gifBtn = document.createElement('button');
    gifBtn.type = 'button';
    gifBtn.className = 'tcx-btn';
    gifBtn.textContent = 'GIF';
    gifBtn.setAttribute('aria-label', 'Send a GIF');
    var drawBtn = document.createElement('button');
    drawBtn.type = 'button';
    drawBtn.className = 'tcx-btn';
    drawBtn.textContent = '✎';
    drawBtn.setAttribute('aria-label', 'Draw a doodle');
    form.insertBefore(gifBtn, submitBtn);
    form.insertBefore(drawBtn, submitBtn);

    var tray = null, pad = null;
    gifBtn.addEventListener('click', function () {
      if (!tray) tray = buildTray(send);
      openModal(tray, gifBtn);
    });
    drawBtn.addEventListener('click', function () {
      if (!pad) pad = buildPad(send);
      openModal(pad, drawBtn);
    });
  }

  window.TrollChatExtras = {
    GIFS: GIFS,
    TEXT_MAX: TEXT_MAX,
    DRAW_MAX: DRAW_MAX,
    bodyCap: bodyCap,
    parseBody: parseBody,
    renderBodyInto: renderBodyInto,
    attachComposer: attachComposer,
  };
})();
