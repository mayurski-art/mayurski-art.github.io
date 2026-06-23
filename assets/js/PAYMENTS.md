# TrollPay — shared Solana payment library

Canonical reference copy of the Phantom/Solana payment module used across the
Troll Runner sites. This is the **home base**; each deployed site keeps its own
working copy of `troll-pay.js` (they're separate GitHub Pages repos), so when
you change this file, sync the copies.

Currently used by:
- **trollrunner-games** — `Revive` (Troll Dash) and `Continue` (Troll Kombat)
- **trollrunner-finance** — the Tip Jar

## What it does

A payment is one SPL token transfer to the treasury, signed in Phantom and
confirmed on-chain. No backend: the confirmed transaction is the authorization.

> ⚠️ This client-only pattern is fine for tips/revives where the action costs
> nothing to grant. It is **not** sufficient when a server must hand out a paid
> credit (e.g. the stickers AI generator) — that needs server-side on-chain
> verification. Don't reuse this alone for that.

## Setup

```html
<script src="assets/js/troll-pay-config.js"></script>  <!-- copy of the .example -->
<script src="assets/js/troll-pay.js"></script>
```

`DEVNET = true` in the config uses fake devnet USDC. Flip to `false` for mainnet
and set `TROLL_MINT` to enable $TROLL.

## API

```js
// Generic payment (tips, arbitrary amounts):
const res = await TrollPay.pay({
  amountUsd: 4.20,
  token: 'USDC',          // or 'TROLL' (auto-falls back to USDC if unavailable)
  taxRate: 0,             // e.g. 0.069 to add a 6.9% tax on top
  onProgress: ({ stage, sig }) => { /* connecting|building|awaiting|confirming */ },
});
// -> { ok:true, txSig, base, tax, total }  |  { ok:false, reason }

// Convenience revive (uses CONFIG.REVIVE_PRICE_USD + CONFIG.TAX_RATE):
await TrollPay.payForRevive(onProgress);

TrollPay.explorerUrl(sig);            // Solscan link (network-aware)
TrollPay.mountTokenPicker(el);        // optional USDC/$TROLL selector
TrollPay.isConnected();               // wallet connected this session?
```

## Testing on devnet

1. Phantom → set network to **Devnet**.
2. Get devnet SOL at https://faucet.solana.com (pays gas).
3. Get devnet USDC at https://spl-token-faucet.com (mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`).
4. Serve the site locally and run a payment — it confirms in ~5–15s.
