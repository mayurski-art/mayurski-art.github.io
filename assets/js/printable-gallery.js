/*
 * Printable sticker gallery.
 * Renders cards from assets/data/stickers.json and produces print-ready
 * downloads: the original high-res PNG, plus PDFs sized in real inches via
 * jsPDF (loaded lazily from CDN on first PDF request).
 *
 * Adding a sticker needs no changes here — drop a PNG in assets/stickers/ and
 * append an entry to the manifest.
 */
(function () {
  'use strict';

  const MANIFEST_URL = 'assets/data/stickers.json';
  const JSPDF_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';

  // Download options shared by every sticker. PDF "inches" = the LONG edge of
  // the printed sticker; the short edge scales to preserve the artwork's shape.
  const OPTIONS = [
    { fmt: 'png',       label: 'High-res PNG',     sub: 'Original image file' },
    { fmt: 'pdf-2',     label: 'PDF — 2″',          sub: 'Small — sticker-bomb size', inches: 2 },
    { fmt: 'pdf-3',     label: 'PDF — 3″',          sub: 'Medium', inches: 3 },
    { fmt: 'pdf-4',     label: 'PDF — 4″',          sub: 'Large', inches: 4 },
    { fmt: 'pdf-sheet', label: 'PDF — Full sheet',       sub: 'Letter page, tiled 2″ copies' }
  ];

  // Full-sheet layout (US Letter, portrait).
  const SHEET = { page: [8.5, 11], tileInches: 2, margin: 0.4, gap: 0.22 };
  // Trim margin around single stickers, leaving room for crop marks.
  const TRIM_MARGIN = 0.22;

  const els = {};
  let activeSticker = null;
  let lastFocused = null;
  let isBusy = false;
  let jspdfPromise = null;
  const rasterCache = {}; // id -> { dataURL, natW, natH }

  /* ---------- helpers ---------- */

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('Image not available: ' + src)); };
      img.src = src;
    });
  }

  function loadJsPDF() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (jspdfPromise) return jspdfPromise;
    jspdfPromise = new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = JSPDF_SRC;
      s.async = true;
      s.onload = function () {
        if (window.jspdf && window.jspdf.jsPDF) resolve(window.jspdf.jsPDF);
        else reject(new Error('PDF engine failed to start'));
      };
      s.onerror = function () { reject(new Error('Could not load the PDF engine')); };
      document.head.appendChild(s);
    });
    return jspdfPromise;
  }

  // Rasterise the master once so jsPDF embeds a clean PNG (and we know its size).
  function getRaster(sticker) {
    if (rasterCache[sticker.id]) return Promise.resolve(rasterCache[sticker.id]);
    return loadImage(sticker.image).then(function (img) {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      const raster = {
        dataURL: canvas.toDataURL('image/png'),
        natW: img.naturalWidth,
        natH: img.naturalHeight
      };
      rasterCache[sticker.id] = raster;
      return raster;
    });
  }

  // Fit artwork so its LONG edge equals `longEdge` inches, preserving aspect.
  function fitLongEdge(longEdge, natW, natH) {
    if (natW >= natH) return { w: longEdge, h: longEdge * natH / natW };
    return { w: longEdge * natW / natH, h: longEdge };
  }

  function drawCropMarks(doc, x, y, w, h) {
    const gap = 0.05;
    const len = 0.12;
    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(0.0035);
    const corners = [
      { cx: x,     cy: y,     sx: 1,  sy: 1  },
      { cx: x + w, cy: y,     sx: -1, sy: 1  },
      { cx: x,     cy: y + h, sx: 1,  sy: -1 },
      { cx: x + w, cy: y + h, sx: -1, sy: -1 }
    ];
    corners.forEach(function (c) {
      doc.line(c.cx - c.sx * gap, c.cy - c.sy * gap, c.cx - c.sx * (gap + len), c.cy - c.sy * gap);
      doc.line(c.cx - c.sx * gap, c.cy - c.sy * gap, c.cx - c.sx * gap, c.cy - c.sy * (gap + len));
    });
  }

  /* ---------- PDF builders ---------- */

  function buildSinglePdf(jsPDF, raster, inches, sticker) {
    const dims = fitLongEdge(inches, raster.natW, raster.natH);
    const pageW = dims.w + TRIM_MARGIN * 2;
    const pageH = dims.h + TRIM_MARGIN * 2;
    const doc = new jsPDF({
      orientation: pageW > pageH ? 'landscape' : 'portrait',
      unit: 'in',
      format: [pageW, pageH]
    });
    doc.addImage(raster.dataURL, 'PNG', TRIM_MARGIN, TRIM_MARGIN, dims.w, dims.h, sticker.id, 'FAST');
    drawCropMarks(doc, TRIM_MARGIN, TRIM_MARGIN, dims.w, dims.h);
    doc.save('trollrunner-' + sticker.id + '-' + inches + 'in.pdf');
  }

  function buildSheetPdf(jsPDF, raster, sticker) {
    const pageW = SHEET.page[0];
    const pageH = SHEET.page[1];
    const doc = new jsPDF({ orientation: 'portrait', unit: 'in', format: SHEET.page });
    const tile = fitLongEdge(SHEET.tileInches, raster.natW, raster.natH);
    const cols = Math.max(1, Math.floor((pageW - 2 * SHEET.margin + SHEET.gap) / (tile.w + SHEET.gap)));
    const rows = Math.max(1, Math.floor((pageH - 2 * SHEET.margin + SHEET.gap) / (tile.h + SHEET.gap)));
    const blockW = cols * tile.w + (cols - 1) * SHEET.gap;
    const blockH = rows * tile.h + (rows - 1) * SHEET.gap;
    const startX = (pageW - blockW) / 2;
    const startY = (pageH - blockH) / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c * (tile.w + SHEET.gap);
        const y = startY + r * (tile.h + SHEET.gap);
        doc.addImage(raster.dataURL, 'PNG', x, y, tile.w, tile.h, sticker.id, 'FAST');
        doc.setDrawColor(205, 205, 205);
        doc.setLineWidth(0.0035);
        doc.rect(x, y, tile.w, tile.h);
      }
    }
    doc.save('trollrunner-' + sticker.id + '-sheet.pdf');
  }

  /* ---------- download orchestration ---------- */

  function setStatus(message) {
    if (els.modalStatus) els.modalStatus.textContent = message || '';
  }

  function setBusy(busy) {
    isBusy = busy;
    Array.prototype.forEach.call(els.modalOptions.querySelectorAll('.print-opt'), function (btn) {
      btn.disabled = busy;
    });
  }

  function downloadPng(sticker) {
    const a = document.createElement('a');
    a.href = sticker.image;
    a.download = 'trollrunner-' + sticker.id + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function handleFormat(option) {
    if (isBusy || !activeSticker) return;
    const sticker = activeSticker;

    if (option.fmt === 'png') {
      downloadPng(sticker);
      setStatus('Saved. Go troll.');
      return;
    }

    setBusy(true);
    setStatus('Cooking your PDF…');
    getRaster(sticker)
      .then(function (raster) {
        return loadJsPDF().then(function (jsPDF) {
          if (option.fmt === 'pdf-sheet') buildSheetPdf(jsPDF, raster, sticker);
          else buildSinglePdf(jsPDF, raster, option.inches, sticker);
        });
      })
      .then(function () { setStatus('Done — check your downloads.'); })
      .catch(function (err) {
        console.warn('[printables] download failed:', err);
        setStatus(/Image not available/.test(err.message)
          ? "That troll's art isn't uploaded yet."
          : 'Could not build the PDF. Try again or grab the PNG.');
      })
      .then(function () { setBusy(false); });
  }

  /* ---------- modal ---------- */

  function openModal(sticker, trigger) {
    activeSticker = sticker;
    lastFocused = trigger || null;
    if (els.modalName) els.modalName.textContent = sticker.title;
    setStatus('');
    els.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    const first = els.modalOptions.querySelector('.print-opt');
    if (first) first.focus();
    document.addEventListener('keydown', onKeydown);
  }

  function closeModal() {
    if (els.modal.hidden) return;
    els.modal.hidden = true;
    document.body.style.overflow = '';
    activeSticker = null;
    document.removeEventListener('keydown', onKeydown);
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key === 'Tab') {
      // Keep focus inside the panel.
      const focusable = els.modal.querySelectorAll('button:not([disabled])');
      if (!focusable.length) return;
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    }
  }

  function buildOptions() {
    els.modalOptions.innerHTML = '';
    OPTIONS.forEach(function (option) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'print-opt';
      btn.innerHTML = esc(option.label) + '<span>' + esc(option.sub) + '</span>';
      btn.addEventListener('click', function () { handleFormat(option); });
      els.modalOptions.appendChild(btn);
    });
  }

  function bindModal() {
    Array.prototype.forEach.call(els.modal.querySelectorAll('[data-print-close]'), function (node) {
      node.addEventListener('click', closeModal);
    });
  }

  /* ---------- render ---------- */

  function renderCards(stickers) {
    const frag = document.createDocumentFragment();
    stickers.forEach(function (sticker) {
      const card = document.createElement('article');
      card.className = 'printable-card';
      if (sticker.bodyPad != null && isFinite(Number(sticker.bodyPad))) {
        card.style.setProperty('--printable-body-pad', Number(sticker.bodyPad) + 'px');
      }
      if (sticker.bodyPadTop != null && isFinite(Number(sticker.bodyPadTop))) {
        card.style.setProperty('--printable-body-pad-top', Number(sticker.bodyPadTop) + 'px');
      }
      if (sticker.artPad != null && isFinite(Number(sticker.artPad))) {
        card.style.setProperty('--printable-art-pad', Number(sticker.artPad) + 'px');
      }
      if (sticker.centerButton) card.classList.add('printable-card--center-btn');
      const bg = sticker.bg || 'light';
      // Optional preview-only down-scale so edge-to-edge square art reads at the
      // same footprint as the portrait masters. Does not affect print output.
      const previewScale = Number(sticker.previewScale);
      const imgStyle = (previewScale > 0 && previewScale < 1)
        ? ' style="max-width:' + (previewScale * 100) + '%;max-height:' + (previewScale * 100) + '%"'
        : '';
      card.innerHTML =
        '<div class="printable-art printable-art--' + esc(bg) + '">' +
          '<img src="' + esc(sticker.image) + '"' + imgStyle + ' alt="' + esc(sticker.title) + ' troll sticker" loading="lazy">' +
          '<span class="printable-art-missing">Art coming soon</span>' +
        '</div>' +
        '<div class="printable-card-body">' +
          '<button class="printable-download-btn" type="button" aria-haspopup="dialog" aria-label="Download ' + esc(sticker.title) + ' for print">Download for print</button>' +
        '</div>';
      card.querySelector('img').addEventListener('error', function () {
        card.querySelector('.printable-art').classList.add('is-missing');
      });
      card.querySelector('.printable-download-btn').addEventListener('click', function () {
        openModal(sticker, this);
      });
      frag.appendChild(card);
    });
    els.grid.innerHTML = '';
    els.grid.appendChild(frag);
  }

  function showEmpty() {
    if (els.empty) els.empty.hidden = false;
  }

  /* ---------- init ---------- */

  function init() {
    els.grid = document.getElementById('printables-grid');
    els.empty = document.getElementById('printables-empty');
    els.modal = document.getElementById('print-modal');
    els.modalName = document.getElementById('print-modal-name');
    els.modalOptions = document.getElementById('print-modal-options');
    els.modalStatus = document.getElementById('print-modal-status');
    if (!els.grid || !els.modal || !els.modalOptions) return;

    buildOptions();
    bindModal();

    fetch(MANIFEST_URL, { cache: 'no-cache' })
      .then(function (resp) {
        if (!resp.ok) throw new Error('manifest HTTP ' + resp.status);
        return resp.json();
      })
      .then(function (data) {
        const list = data && Array.isArray(data.stickers) ? data.stickers : [];
        if (!list.length) { showEmpty(); return; }
        renderCards(list);
      })
      .catch(function (err) {
        console.warn('[printables] could not load manifest:', err);
        showEmpty();
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
