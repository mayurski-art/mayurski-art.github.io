/* PFP Studio in the Barracks (user, 2026-10-26: "an option to customize
   your profile picture in Career/Barracks ... trollrunner.net/pfp
   integrated in here"). The site's own studio (pfp.html, same origin) opens
   over the menu in a frame; nothing of it is copied here. Its "Save as my
   profile picture" uploads through the shared accounts script inside the
   frame, so when the frame reports a change (its trollrunner:auth-changed),
   and again on the way out, the game's own accounts copy refreshes the
   profile: the calling card, the top bar and the party row pick the new
   picture up from the auth-changed that follows. Back, Esc (here or inside
   the studio) or B on a pad close it. */

let open = null;

export function openPfpStudio() {
  if (open) return;
  const accounts = window.TrollrunnerAccounts;
  const back = document.activeElement;
  const wrap = document.createElement("div");
  wrap.className = "to-pfp-studio";
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-modal", "true");
  wrap.setAttribute("aria-label", "PFP Studio");
  wrap.innerHTML = `<header class="to-pfp-bar">
      <button type="button" class="to-pfp-back">Back</button>
      <b>Profile picture</b>
      <span>Build your troll, then press <em>Save as my profile picture</em>.</span>
    </header>
    <iframe class="to-pfp-frame" src="pfp.html" title="PFP Studio"></iframe>`;
  document.body.appendChild(wrap);
  const frame = wrap.querySelector("iframe");
  const refresh = () => { try { accounts?.refreshProfile?.(); } catch {} };
  const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } };
  // the studio's own saves (and sign-ins) reach the game straight away
  frame.addEventListener("load", () => {
    try {
      const w = frame.contentWindow;
      w.addEventListener("trollrunner:auth-changed", refresh);
      w.addEventListener("keydown", onKey, true);
    } catch {}   // (a link inside the studio that left the site)
  });
  addEventListener("keydown", onKey, true);
  // a pad's B
  let raf = 0, was = true;
  const pad = () => {
    const gp = [...(navigator.getGamepads?.() || [])].find((p) => p && p.connected);
    const b = !!gp?.buttons[1]?.pressed;
    if (b && !was) { close(); return; }
    was = b;
    raf = requestAnimationFrame(pad);
  };
  raf = requestAnimationFrame(pad);
  function close() {
    if (!open) return;
    open = null;
    cancelAnimationFrame(raf);
    removeEventListener("keydown", onKey, true);
    wrap.remove();
    refresh();
    back?.focus?.();
  }
  wrap.querySelector(".to-pfp-back").addEventListener("click", close);
  wrap.querySelector(".to-pfp-back").focus();
  open = { close };
}

export const pfpStudioOpen = () => !!open;
