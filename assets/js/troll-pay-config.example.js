/*
 * TROLL_PAY_CONFIG — template. Copy this to `troll-pay-config.js` in the site
 * that uses TrollPay and adjust. Load it BEFORE troll-pay.js.
 *
 *   <script src="assets/js/troll-pay-config.js"></script>
 *   <script src="assets/js/troll-pay.js"></script>
 */
(function () {
  'use strict';

  // true  = devnet (fake money, safe for testing)
  // false = mainnet (real money — flip before going live)
  var DEVNET = true;

  window.TROLL_PAY_CONFIG = {

    DEVNET_MODE: DEVNET,

    // ── Solana ──────────────────────────────────────────────────────────────
    SOLANA_NETWORK:  DEVNET ? 'devnet' : 'mainnet-beta',
    // NOTE: api.mainnet-beta.solana.com now returns 403 to browser apps, so for
    // mainnet use PublicNode's free, no-key, CORS-enabled endpoint (or drop in a
    // Helius/QuickNode URL for higher reliability). The public devnet RPC is
    // unreliable for confirmation — prefer mainnet or a dedicated devnet RPC.
    SOLANA_RPC:      DEVNET ? 'https://api.devnet.solana.com'
                            : 'https://solana-rpc.publicnode.com',
    EXPLORER_BASE:   'https://solscan.io/tx/',
    EXPLORER_SUFFIX: DEVNET ? '?cluster=devnet' : '',

    // Where every payment lands. Single transfer — no splits.
    TREASURY_WALLET: '79vVRZ7qnZfj9xCto5d9Kwf4eAimqMDrQysZjHBbFbsA',

    // ── Token mints ───────────────────────────────────────────────────────────
    // Devnet USDC (Circle). Mainnet USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
    USDC_MINT:     DEVNET ? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
                          : 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDC_DECIMALS: 6,
    // $TROLL has no devnet equivalent. While this is 'FILL_ME_IN' (or in devnet)
    // the $TROLL option is hidden and everything runs on USDC.
    // Real $TROLL (Solana mainnet): 5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2
    // The $TROLL mint has 6 decimals (verified on-chain) — NOT 9.
    TROLL_MINT:     'FILL_ME_IN',
    TROLL_DECIMALS: 6,

    // ── Price feed ($TROLL → USD) ─────────────────────────────────────────────
    // Jupiter Price API v3 (free lite tier):
    //   { "<mint>": { "usdPrice": <number>, "decimals": <int>, ... } }
    PRICE_FEED_URL: 'https://lite-api.jup.ag/price/v3?ids=',

    // ── Pricing (only used by payForRevive convenience helper) ──────────────────
    // Generic pay({ amountUsd, taxRate }) ignores these.
    REVIVE_PRICE_USD: 0.69,
    TAX_RATE:         0.069,
  };
})();
