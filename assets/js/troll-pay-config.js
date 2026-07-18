/*
 * TROLL_PAY_CONFIG for the main site.
 * Canonical TrollPay lib lives right here too (assets/js/troll-pay.js) — every
 * sibling site loads THIS file cross-origin. The main site itself only uses
 * TrollPay for read-only balance lookups (TrollPay.getBalances) behind the
 * hub's "Connect Wallet" button — no pay()/payForRevive() calls happen here.
 */
(function () {
  'use strict';

  // false = mainnet (real $TROLL + USDC). Matches every other site on the network.
  var DEVNET = false;

  window.TROLL_PAY_CONFIG = {

    DEVNET_MODE: DEVNET,

    SOLANA_NETWORK:  DEVNET ? 'devnet' : 'mainnet-beta',
    // api.mainnet-beta.solana.com 403s browser apps — use PublicNode (free, no key).
    SOLANA_RPC:      DEVNET ? 'https://api.devnet.solana.com'
                            : 'https://solana-rpc.publicnode.com',
    EXPLORER_BASE:   'https://solscan.io/tx/',
    EXPLORER_SUFFIX: DEVNET ? '?cluster=devnet' : '',

    // The Troll Fund treasury — same wallet every payment on the network lands in.
    TREASURY_WALLET: '79vVRZ7qnZfj9xCto5d9Kwf4eAimqMDrQysZjHBbFbsA',

    // Mainnet USDC. Devnet USDC: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
    USDC_MINT:     DEVNET ? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
                          : 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDC_DECIMALS: 6,
    // $TROLL — Solana mainnet, 6 decimals (verified). No devnet equivalent.
    TROLL_MINT:     DEVNET ? 'FILL_ME_IN'
                          : '5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2',
    TROLL_DECIMALS: 6,

    // Jupiter Price API v3 (free lite tier) — unused here (no pay() calls on
    // this page) but kept for parity with the shared config shape.
    PRICE_FEED_URL: 'https://lite-api.jup.ag/price/v3?ids=',

    REVIVE_PRICE_USD: 0.69,
    TAX_RATE:         0.069,
  };
})();
