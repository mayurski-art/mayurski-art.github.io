// Shared on-screen readout for troubleshooting controllers that connect but
// don't behave — shows the raw id/mapping/axes/buttons so a pad reporting a
// non-"standard" mapping (common with generic/no-name Bluetooth controllers,
// especially on iOS) can be diagnosed without desktop devtools access.
// Auto-appears for non-standard pads, or always via ?gpdebug=1.
export function createGamepadDebug(containerEl) {
  const forced = /[?&]gpdebug=1/.test(location.search);
  let el = containerEl;
  if (!el) {
    el = document.createElement("div");
    el.id = "gp-debug";
    el.hidden = true;
    Object.assign(el.style, {
      position: "fixed", left: "10px", bottom: "10px", maxWidth: "320px",
      background: "rgba(0,0,0,.75)", color: "#0f0", font: "11px/1.4 monospace",
      padding: "8px 10px", borderRadius: "8px", whiteSpace: "pre-wrap",
      pointerEvents: "none", zIndex: 9999,
    });
    document.body.appendChild(el);
  }
  function render(gp) {
    if (!gp) {
      if (!forced) el.hidden = true;
      else { el.hidden = false; el.textContent = "No gamepad detected.\nPress any button on the controller."; }
      return;
    }
    const nonStandard = gp.mapping !== "standard";
    if (!forced && !nonStandard) { el.hidden = true; return; }
    el.hidden = false;
    const axes = gp.axes.map((a, i) => `${i}:${a.toFixed(2)}`).join(" ");
    const buttons = gp.buttons.map((b, i) => (b.pressed || b.value > 0.1) ? i : null).filter((v) => v !== null).join(",") || "none";
    el.textContent =
      `id: ${gp.id}\n` +
      `mapping: "${gp.mapping}"${nonStandard ? "  (NON-STANDARD — layout may be scrambled)" : ""}\n` +
      `axes: ${axes}\n` +
      `pressed: ${buttons}`;
  }
  return { render, forced };
}
