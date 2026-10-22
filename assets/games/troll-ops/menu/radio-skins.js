// Troll Forces radio skins: the markup for each look. radio.js mounts one
// into #to-radio-panel and wires the controls by id, so every skin carries
// the same ids (to-radio-play, to-radio-eq, ...) in its own layout.
//
//   grin  Grinspace: the old Media Player Headspace skin, trollface head
//   girl  pink window, the Royale photo girl in the bump under the screen
//   don   black and gold window, the tuxedo troll under the screen
//
// Art is the user's own images, used as given. [data-station] and
// [data-station-mode] get the live map/mode name (see radio.js).

const ICON = {
  prev: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3h2v10H3zM14 3v10L6 8z"/></svg>`,
  play: `<svg viewBox="0 0 16 16" aria-hidden="true"><path class="gs-ico-play" d="M4 2.5v11L13.5 8z"/><path class="gs-ico-pause" d="M3.5 3h3v10h-3zM9.5 3h3v10h-3z"/></svg>`,
  stop: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5h9v9h-9z"/></svg>`,
  next: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11 3h2v10h-2zM2 3v10l8-5z"/></svg>`,
  shuffle: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 4h3l6 8h3v-2l3 3-3 3v-2h-4L3 6H1zM10 4h3V2l3 3-3 3V6h-2l-1.6 2.1-1.2-1.6z"/></svg>`,
};

/* The two the player switches between. Grinspace stays mountable for
   anyone who saved it, with a button across to the girl radio. */
export const SKIN_IDS = ["girl", "don"];

/* One round button that flips to the other radio: black on the girl
   radio (to the male one), pink on the male radio (back to the girl). */
const swap = (to, cls) => {
  const label = to === "don" ? "Switch to the male radio" : "Switch to the girl radio";
  return `<button type="button" class="rs-swap rs-swap-${to} ${cls}" data-skin="${to}" aria-label="${label}" title="${label}"></button>`;
};

const grin = `
  <div class="gs-wing gs-wing-l">
    <div class="gs-pods" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="gs-inset gs-eq">
      <div class="gs-sliders">
        <label><span>Balance</span><input type="range" id="to-radio-balance" min="-100" max="100" step="1" value="0" aria-label="Balance"></label>
        <label><span>Volume</span><input type="range" id="to-radio-volume" min="0" max="100" step="1" aria-label="Volume"></label>
      </div>
      <div class="gs-bands" id="to-radio-eq" role="group" aria-label="Equalizer"></div>
      <button type="button" class="gs-reset" id="to-radio-eqreset">reset</button>
    </div>
  </div>

  <div class="gs-core">
    <img class="gs-head" src="assets/games/troll-ops/ui/radio-grin-head.webp?v=gs1" alt="" draggable="false">
    <div class="gs-crown">
      <button type="button" class="gs-x" id="to-radio-close" aria-label="Close radio">×</button>
    </div>
    <div class="gs-transport">
      <div class="gs-pill">
        <button type="button" class="gs-btn" id="to-radio-prev" aria-label="Previous track">${ICON.prev}</button>
        <button type="button" class="gs-btn" id="to-radio-play" aria-label="Play">${ICON.play}</button>
        <button type="button" class="gs-btn" id="to-radio-stop" aria-label="Stop">${ICON.stop}</button>
        <button type="button" class="gs-btn" id="to-radio-next" aria-label="Next track">${ICON.next}</button>
      </div>
      <button type="button" class="gs-btn gs-shuffle" id="to-radio-shuffle" aria-label="Shuffle" aria-pressed="false">${ICON.shuffle}</button>
    </div>
    <div class="gs-screen">
      <canvas id="to-radio-viz" width="360" height="232" aria-hidden="true"></canvas>
      <div class="gs-readout">
        <div class="gs-marquee"><span><b id="to-radio-title">No tracks loaded</b> <em id="to-radio-artist"></em></span></div>
        <span class="gs-time" id="to-radio-time">0:00</span>
      </div>
    </div>
    <div class="gs-seek">
      <svg class="gs-mini" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 14V9h2v5zM6 14V4h2v10zM10 14V7h2v7zM14 14V2h-1v12z"/></svg>
      <input type="range" id="to-radio-seek" min="0" max="1000" step="1" value="0" aria-label="Seek">
      <svg class="gs-mini" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1h7l3 3v11H3zM5 7h6v1H5zm0 2h6v1H5zm0 2h4v1H5z"/></svg>
    </div>
  </div>

  <div class="gs-wing gs-wing-r">
    <div class="gs-inset gs-list">
      <div class="gs-list-head"><span class="gs-disc" aria-hidden="true"></span><span data-station>Troll Warfare FM</span></div>
      <ol id="to-radio-list" aria-label="Playlist"></ol>
    </div>
    <div class="gs-pods" aria-hidden="true"><i></i><i></i><i></i></div>
  </div>
  ${swap("girl", "gs-swap")}`;

/* The pink and black-tie skins share one window layout; only the art, the
   palette and a couple of decorations differ. */
const fm = (skin, art) => `
  <div class="fm-spk fm-spk-l" aria-hidden="true"><i class="fm-tw"></i><i class="fm-woof"></i></div>
  <div class="fm-spk fm-spk-r" aria-hidden="true"><i class="fm-tw"></i><i class="fm-woof"></i></div>
  <div class="fm-win">
    <div class="fm-bump" aria-hidden="true"></div>
    <div class="fm-art" aria-hidden="true">${art}</div>
    <div class="fm-bar">
      <div class="fm-titles"><b data-station>Troll Warfare FM</b><small data-station-mode></small></div>
      ${swap(skin === "girl" ? "don" : "girl", "fm-swap")}
      <button type="button" class="fm-x" id="to-radio-close" aria-label="Close radio">×</button>
    </div>

    <section class="fm-col fm-eq" aria-label="Equalizer and levels">
      <h3><i class="fm-dot" aria-hidden="true"></i>Equalizer</h3>
      <div class="fm-bands" id="to-radio-eq" role="group" aria-label="Equalizer"></div>
      <button type="button" class="fm-reset" id="to-radio-eqreset">reset</button>
      <label class="fm-level"><span>Balance</span><input type="range" id="to-radio-balance" min="-100" max="100" step="1" value="0" aria-label="Balance"><em>L</em><em>R</em></label>
      <label class="fm-level"><span>Volume</span><input type="range" id="to-radio-volume" min="0" max="100" step="1" aria-label="Volume"></label>
    </section>

    <section class="fm-mid">
      <div class="fm-screen">
        <canvas id="to-radio-viz" width="440" height="200" aria-hidden="true"></canvas>
        <div class="fm-readout">
          <div class="gs-marquee"><span><b id="to-radio-title">No tracks loaded</b> <em id="to-radio-artist"></em></span></div>
          <span class="fm-time" id="to-radio-time">0:00</span>
        </div>
      </div>
      <input type="range" class="fm-seek" id="to-radio-seek" min="0" max="1000" step="1" value="0" aria-label="Seek">
      <div class="fm-transport">
        <button type="button" class="fm-btn" id="to-radio-prev" aria-label="Previous track">${ICON.prev}</button>
        <button type="button" class="fm-btn" id="to-radio-play" aria-label="Play">${ICON.play}</button>
        <button type="button" class="fm-btn" id="to-radio-stop" aria-label="Stop">${ICON.stop}</button>
        <button type="button" class="fm-btn" id="to-radio-next" aria-label="Next track">${ICON.next}</button>
        <button type="button" class="fm-btn fm-shuffle" id="to-radio-shuffle" aria-label="Shuffle" aria-pressed="false">${ICON.shuffle}</button>
      </div>
    </section>

    <section class="fm-col fm-list" aria-label="Playlist">
      <h3><i class="fm-dot" aria-hidden="true"></i><span data-station>Troll Warfare FM</span></h3>
      <ol id="to-radio-list" aria-label="Playlist"></ol>
      <footer><span id="to-radio-count"></span><span id="to-radio-total"></span><span class="fm-shufstate" id="to-radio-shufstate"></span></footer>
    </section>
    ${skin === "don" ? `<div class="fm-foot"><span>✦ <span data-station>Troll Warfare FM</span> ✦</span><i aria-hidden="true"></i><span>Media player v2.0 ✦</span></div>` : ""}
  </div>`;

export const SKINS = {
  grin: { cls: "gs", label: "Grinspace radio", html: grin },
  girl: {
    cls: "fm fm-girl", label: "Pink radio",
    html: fm("girl", `<img data-src="assets/games/troll-ops/textures/royale-photo.jpg" alt="" draggable="false">`),
    viz: ["#ff5fa8", "#c86bff"],
  },
  don: {
    cls: "fm fm-don", label: "Black tie radio",
    // The user's tuxedo-and-rose troll (ui/radio-don.png), used as given.
    html: fm("don", `<img data-src="assets/games/troll-ops/ui/radio-don.png" alt="" draggable="false">`),
    viz: ["#8b5cf6", "#d9b25f"],
  },
};
