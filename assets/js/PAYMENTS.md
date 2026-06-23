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

### RPC endpoints (important)

- `api.mainnet-beta.solana.com` now returns **403** to browser apps — do not use it.
- Default mainnet RPC is **`https://solana-rpc.publicnode.com`** (free, no key,
  CORS-enabled). For production reliability, drop in a Helius/QuickNode URL.
- The public **devnet** RPC (`api.devnet.solana.com`) is unreliable for
  confirmation — transactions land but `getSignatureStatus` often returns null,
  causing the UI to hang on "confirming". Prefer mainnet or a dedicated devnet RPC.

### $TROLL token

- Mainnet mint: `5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2`, **6 decimals**.
- No devnet equivalent — the $TROLL option only appears on mainnet.
- Price (USD) comes from Jupiter Price API v3:
  `https://lite-api.jup.ag/price/v3?ids=<mint>` → `{ "<mint>": { "usdPrice": … } }`.

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
TrollPay.mountTokenPicker(el, onChange);  // USDC/$TROLL selector; onChange(token) optional
TrollPay.isConnected();               // wallet connected this session?
```

## Testing

**Mainnet (recommended — required for $TROLL).** Tipping your own treasury costs
only gas (~$0.001 SOL); the tokens land in the treasury you control. Set Phantom
to **Mainnet**, hold a little SOL + USDC (or $TROLL), and run a small tip.

**Devnet (USDC only, no $TROLL).** Phantom → **Devnet**; get devnet SOL at
https://faucet.solana.com and devnet USDC at https://spl-token-faucet.com (mint
`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`). Note the public devnet RPC may
hang on confirmation — see the RPC note above.
