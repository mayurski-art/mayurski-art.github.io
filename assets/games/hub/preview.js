/* GAME PREVIEW — Steam-style "store page" modal shown when a hub card is
   clicked, before the game actually launches. Self-contained singleton, same
   shape as fs-launcher.js: injects nothing (styles are a plain <link> in
   games.html), binds via delegated click, closes on Escape/backdrop/close.

   Card click vs Play Now click: fs-launcher.js binds its OWN delegated click
   listener on a[data-fs] and calls stopPropagation-free preventDefault, which
   fires in bubble phase alongside this file's listener. To keep "Play Now"
   instant (no preview detour) while any other click on the card opens the
   preview, this file's card listener explicitly ignores clicks that targeted
   the play link itself. */
(() => {
  "use strict";
  if (window.TrollGamePreview) return; // singleton

  let backdrop = null;
  let lastFocused = null;

  function readCard(card) {
    const art = card.querySelector(".hub-card-art img");
    const tag = card.querySelector(".hub-card-tag");
    const title = card.querySelector("h3")?.textContent?.trim() || "Untitled";
    const meta = card.querySelector(".hub-card-meta")?.textContent?.trim() || "";
    const playLink = card.querySelector("a.hub-card-play");
    const locked = card.classList.contains("is-locked");

    let data = {};
    try { data = JSON.parse(card.dataset.preview || "{}"); } catch { /* malformed, use defaults */ }

    return {
      title,
      meta,
      tagLabel: tag?.textContent?.trim() || "",
      artSrc: art?.getAttribute("src") || null,
      artAlt: art?.getAttribute("alt") || title,
      href: playLink?.getAttribute("href") || null,
      fsTitle: playLink?.dataset.fs || title,
      locked,
      summary: data.summary || "",
      controls: Array.isArray(data.controls) ? data.controls : [],
      screenshots: Array.isArray(data.screenshots) && data.screenshots.length
        ? data.screenshots
        : (art ? [art.getAttribute("src")] : []),
      playersOnline: data.playersOnline || null,
    };
  }

  function badgeHtml(playersOnline) {
    if (playersOnline === "live") {
      return '<span class="gp-badge gp-badge--live">🌐 Multiplayer</span>';
    }
    if (playersOnline === "single") {
      return '<span class="gp-badge gp-badge--single">👤 Single-player</span>';
    }
    return "";
  }

  function render(info) {
    const gallerySrc = info.screenshots[0];
    const playDisabled = info.locked || !info.href;

    const modal = document.createElement("div");
    modal.className = "gp-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", info.title);
    modal.innerHTML = `
      <button type="button" class="gp-close" aria-label="Close preview">✕</button>
      <div class="gp-gallery">
        ${info.tagLabel ? `<span class="gp-tag">${info.tagLabel}</span>` : ""}
        ${gallerySrc ? `<img src="${gallerySrc}" alt="${info.artAlt}">` : ""}
      </div>
      <div class="gp-body">
        <h2 class="gp-title">${info.title}</h2>
        <div class="gp-meta-row">
          ${info.meta ? `<span class="gp-badge">${info.meta}</span>` : ""}
          ${badgeHtml(info.playersOnline)}
        </div>
        ${info.summary ? `<p class="gp-summary">${info.summary}</p>` : ""}
        ${info.controls.length ? `
          <div>
            <p class="gp-section-label">Controls</p>
            <ul class="gp-controls">
              ${info.controls.map((c) => `<li>${c}</li>`).join("")}
            </ul>
          </div>
        ` : ""}
        ${playDisabled
          ? `<span class="gp-play is-disabled">${info.locked ? "Coming soon" : "Unavailable"}</span>`
          : `<a class="gp-play" href="${info.href}">Play Now ▶</a>`
        }
      </div>
    `;

    if (!playDisabled) {
      modal.querySelector(".gp-play").addEventListener("click", (e) => {
        e.preventDefault();
        close();
        if (window.TrollFSLauncher) window.TrollFSLauncher.open(info.href, info.fsTitle);
        else window.location.href = info.href;
      });
    }

    modal.querySelector(".gp-close").addEventListener("click", close);
    return modal;
  }

  function open(card) {
    if (backdrop) close();
    const info = readCard(card);
    lastFocused = document.activeElement;

    backdrop = document.createElement("div");
    backdrop.className = "gp-backdrop";
    backdrop.appendChild(render(info));
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close();
    });
    document.body.appendChild(backdrop);

    const closeBtn = backdrop.querySelector(".gp-close");
    if (closeBtn) closeBtn.focus();
  }

  function close() {
    if (!backdrop) return;
    backdrop.remove();
    backdrop = null;
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
    lastFocused = null;
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && backdrop) close();
  });

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    // Play Now stays an instant launch — don't intercept it or anything
    // inside it (fs-launcher.js's own delegated listener handles the click).
    if (e.target.closest("a.hub-card-play")) return;
    const card = e.target.closest(".hub-card");
    if (!card) return;
    e.preventDefault();
    open(card);
  });

  window.TrollGamePreview = { open: (card) => open(card), close };
})();
