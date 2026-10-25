// Troll Forces — the match view's WebGL context going away. iOS drops a
// page's context when the GPU runs short (a heavy map on a phone), and the
// game used to just stop drawing. three keeps the context restorable and
// rebuilds everything when it's back; this says what's happening meanwhile,
// lets the game step its graphics down (onRestore) so it doesn't run short
// again, and offers a reload if the context never comes back.
// tools/troll-ops-phone-mem-test.mjs loses and restores it.

export const contextGuard = { lost: 0, restored: 0 };
const GIVE_UP_MS = 8000;

let note = null;
function show(text, reload) {
  if (!note) {
    note = document.createElement("div");
    note.setAttribute("role", "status");
    note.setAttribute("aria-live", "polite");
    note.style.cssText = "position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:99;display:flex;gap:10px;align-items:center;padding:10px 14px;border-radius:12px;background:rgba(28,28,30,.92);border:.5px solid rgba(255,255,255,.18);color:#fff;font:600 14px/1.2 'DM Sans',system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.4)";
    document.body.appendChild(note);
  }
  note.textContent = text;
  if (reload) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = "Reload";
    b.style.cssText = "font:inherit;padding:6px 12px;border-radius:9px;border:0;background:#fff;color:#1c1c1e;cursor:pointer";
    b.addEventListener("click", () => location.reload());
    note.appendChild(b);
  }
  note.hidden = false;
}

export function guardContext(renderer, { onRestore } = {}) {
  const canvas = renderer.domElement;
  let giveUp = 0;
  canvas.addEventListener("webglcontextlost", () => {
    contextGuard.lost++;
    show("Graphics ran out of memory, getting them back…");
    clearTimeout(giveUp);
    giveUp = setTimeout(() => show("Graphics didn't come back.", true), GIVE_UP_MS);
  });
  canvas.addEventListener("webglcontextrestored", () => {
    contextGuard.restored++;
    clearTimeout(giveUp);
    if (note) note.hidden = true;
    onRestore?.();
  });
}
