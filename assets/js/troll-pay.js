/*
 * TrollPay — canonical Phantom / Solana payment library for Troll Runner.
 *
 * This is the reference copy. The arcade games and the finance tip jar each
 * keep their own working copy of this file; keep them in sync with this one.
 *
 * A payment is a single SPL token transfer to the treasury, signed in Phantom
 * and confirmed on-chain. There is no backend — for tips/revives the confirmed
 * transaction itself is the authorization (money simply has to move to the
 * treasury). Do NOT use this pattern alone for anything where the server must
 * grant a credit; that needs server-side verification (see the stickers repo).
 *
 * Depends on window.TROLL_PAY_CONFIG (see troll-pay-config.example.js).
 * Builds the SPL transfer manually — no @solana/spl-token needed.
 *
 * Public API (window.TrollPay):
 *   loadWeb3()                       -> Promise<web3 namespace>
 *   connect()                        -> Promise<{ address }>   (opens Phantom)
 *   isConnected() / getWallet()
 *   trollAvailable()                 -> bool   ($TROLL usable on this network)
 *   setToken('USDC'|'TROLL') / getToken()
 *   pay({ amountUsd, token?, taxRate?, onProgress? })
 *        -> { ok, txSig, base, tax, total } | { ok:false, reason }
 *   payForRevive(onProgress)         -> { ok, txSig } | { ok:false, reason }
 *        (convenience: uses CONFIG.REVIVE_PRICE_USD + CONFIG.TAX_RATE)
 *   explorerUrl(sig) / costLabel(token) / mountTokenPicker(el)
 */
(function () {
  'use strict';

  var CFG = window.TROLL_PAY_CONFIG;

  // Well-known program IDs (shared across mainnet + devnet).
  var TOKEN_PROGRAM_ID_STR  = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  var ATA_PROGRAM_ID_STR    = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
  var SYSTEM_PROGRAM_ID_STR = '11111111111111111111111111111111';
  var COMPUTE_BUDGET_PROGRAM_ID_STR = 'ComputeBudget111111111111111111111111111111';
  var WEB3_CDN = 'https://unpkg.com/@solana/web3.js@1.95.8/lib/index.iife.min.js';

  var _web3 = null;       // loaded @solana/web3.js namespace
  var _wallet = null;     // { address }
  var _token = 'USDC';    // current pay token
  var _accountListener = false;  // attached the Phantom accountChanged listener?

  // ── web3.js loader ──────────────────────────────────────────────────────────
  function loadWeb3() {
    if (_web3) return Promise.resolve(_web3);
    if (window.solanaWeb3) { _web3 = window.solanaWeb3; return Promise.resolve(_web3); }
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = WEB3_CDN;
      s.onload = function () {
        if (window.solanaWeb3) { _web3 = window.solanaWeb3; resolve(_web3); }
        else reject(new Error('web3.js failed to initialise'));
      };
      s.onerror = function () { reject(new Error('Could not load Solana library')); };
      document.head.appendChild(s);
    });
  }

  function getPhantom() {
    return (window.phantom && window.phantom.solana) || window.solana || null;
  }

  // ── Wallet connection ────────────────────────────────────────────────────────
  async function connect() {
    var phantom = getPhantom();
    if (!phantom || !phantom.isPhantom) throw new Error('Phantom not installed');
    var resp = await phantom.connect();
    _wallet = { address: resp.publicKey.toString() };
    // Keep _wallet in sync when the user switches accounts in Phantom, so they
    // don't have to reload the page to pay from a different account.
    if (phantom.on && !_accountListener) {
      _accountListener = true;
      phantom.on('accountChanged', function (pubkey) {
        _wallet = pubkey ? { address: pubkey.toString() } : null;
      });
    }
    return _wallet;
  }

  function isConnected() { return !!_wallet; }
  function getWallet()   { return _wallet; }

  // ── Token availability + selection ────────────────────────────────────────────
  function trollAvailable() {
    return !CFG.DEVNET_MODE && CFG.TROLL_MINT && CFG.TROLL_MINT !== 'FILL_ME_IN';
  }
  function setToken(t)  { _token = (t === 'TROLL' && trollAvailable()) ? 'TROLL' : 'USDC'; return _token; }
  function getToken()   { return _token; }

  // ── Pricing helpers ────────────────────────────────────────────────────────────
  function revivePricing() {
    var base = CFG.REVIVE_PRICE_USD || 0;
    var tax  = base * (CFG.TAX_RATE || 0);
    return { base: base, tax: tax, total: base + tax };
  }

  // USD label for revive buttons. USDC is deterministic; $TROLL is computed at
  // pay time from the live price, so we label it in USD terms.
  function costLabel(token) {
    var t = revivePricing().total;
    if ((token || _token) === 'TROLL') return '$' + t.toFixed(2) + ' in $TROLL';
    return t.toFixed(2) + ' USDC';
  }

  var _lastTrollPrice = 0;   // last good price — lets $TROLL survive a flaky moment
  async function fetchTrollPrice() {
    if (!trollAvailable()) throw new Error('$TROLL not configured');
    try {
      var resp = await fetch(CFG.PRICE_FEED_URL + CFG.TROLL_MINT, { signal: makeSignal(12000) });
      if (!resp.ok) throw new Error('Price feed unavailable');
      var data  = await resp.json();
      // Jupiter Price API v3:  { "<mint>": { "usdPrice": <number>, ... } }
      // (older v2 used data.data[mint].price — fall back to it just in case)
      var entry = (data && data[CFG.TROLL_MINT]) ||
                  (data && data.data && data.data[CFG.TROLL_MINT]);
      var price = entry && (entry.usdPrice != null ? entry.usdPrice : entry.price);
      if (!price || Number(price) <= 0) throw new Error('Could not get $TROLL price');
      _lastTrollPrice = Number(price);
      return _lastTrollPrice;
    } catch (e) {
      if (_lastTrollPrice > 0) return _lastTrollPrice;   // stale but usable
      throw e;
    }
  }
  // Warm the price cache in the background (call on load) so a later revive
  // can build a $TROLL URL even if the network is flaky at that moment.
  function warmTrollPrice() {
    if (trollAvailable()) fetchTrollPrice().catch(function () {});
  }

  function toRawUnits(usdTotal, pricePerToken, decimals) {
    var amount = usdTotal / pricePerToken;
    return BigInt(Math.ceil(amount * Math.pow(10, decimals)));
  }

  // ── SPL transfer construction ──────────────────────────────────────────────────
  function programKeys(web3) {
    return {
      TOKEN:  new web3.PublicKey(TOKEN_PROGRAM_ID_STR),
      ATA:    new web3.PublicKey(ATA_PROGRAM_ID_STR),
      SYSTEM: new web3.PublicKey(SYSTEM_PROGRAM_ID_STR),
    };
  }

  function findATA(web3, owner, mint) {
    var pk = programKeys(web3);
    return web3.PublicKey.findProgramAddressSync(
      [owner.toBuffer(), pk.TOKEN.toBuffer(), mint.toBuffer()],
      pk.ATA
    )[0];
  }

  function encodeTransferData(amountBigInt) {
    // SPL Token instruction 3 = Transfer; layout [u8 ix, u64 amount LE]
    var data = new Uint8Array(9);
    data[0] = 3;
    new DataView(data.buffer).setBigUint64(1, amountBigInt, true);
    return data;
  }

  // Compute-budget (priority fee) instructions, built manually so we don't pull
  // in @solana/web3.js's ComputeBudgetProgram helpers — those use Node's Buffer,
  // which isn't defined in the browser IIFE build ("Buffer is not defined").
  function computeUnitLimitIx(web3, units) {
    var data = new Uint8Array(5);
    data[0] = 2; // SetComputeUnitLimit
    new DataView(data.buffer).setUint32(1, units >>> 0, true);
    return new web3.TransactionInstruction({
      programId: new web3.PublicKey(COMPUTE_BUDGET_PROGRAM_ID_STR), keys: [], data: data,
    });
  }
  function computeUnitPriceIx(web3, microLamports) {
    var data = new Uint8Array(9);
    data[0] = 3; // SetComputeUnitPrice
    new DataView(data.buffer).setBigUint64(1, BigInt(microLamports), true);
    return new web3.TransactionInstruction({
      programId: new web3.PublicKey(COMPUTE_BUDGET_PROGRAM_ID_STR), keys: [], data: data,
    });
  }

  // CreateAssociatedTokenAccountIdempotent (variant 1) for owner+mint. The
  // "idempotent" variant is a safe no-op if the account already exists, so we
  // ALWAYS include it rather than relying on a (sometimes flaky) getAccountInfo
  // pre-check. This guarantees the destination token account exists before the
  // transfer and avoids "ProgramAccountNotFound" when the treasury has never
  // held that token before.
  function createAtaIdempotentInstruction(web3, payer, owner, mint) {
    var pk  = programKeys(web3);
    var ata = findATA(web3, owner, mint);
    return new web3.TransactionInstruction({
      programId: pk.ATA,
      keys: [
        { pubkey: payer,     isSigner: true,  isWritable: true  },
        { pubkey: ata,       isSigner: false, isWritable: true  },
        { pubkey: owner,     isSigner: false, isWritable: false },
        { pubkey: mint,      isSigner: false, isWritable: false },
        { pubkey: pk.SYSTEM, isSigner: false, isWritable: false },
        { pubkey: pk.TOKEN,  isSigner: false, isWritable: false },
      ],
      data: new Uint8Array([1]),
    });
  }

  async function buildTransferTx(web3, senderAddress, mintStr, rawAmount) {
    var connection = new web3.Connection(CFG.SOLANA_RPC, 'confirmed');
    var sender     = new web3.PublicKey(senderAddress);
    var treasury   = new web3.PublicKey(CFG.TREASURY_WALLET);
    var mint       = new web3.PublicKey(mintStr);
    var pk         = programKeys(web3);

    var sourceATA = findATA(web3, sender, mint);
    var destATA   = findATA(web3, treasury, mint);

    // We intentionally do NOT pre-check balances here — always build the transfer
    // and let Phantom show it. If the wallet lacks the token/funds, Phantom (and
    // the chain) will report it on approval.
    var latest = await connection.getLatestBlockhash('confirmed');
    var tx = new web3.Transaction({ recentBlockhash: latest.blockhash, feePayer: sender });

    // Priority fee. Without one, a transfer often gets a signature but never
    // lands on a congested mainnet — validators drop it, which surfaces as a
    // "confirming → timed out". This adds ~0.00001 SOL to greatly improve landing.
    tx.add(computeUnitLimitIx(web3, 100000));
    tx.add(computeUnitPriceIx(web3, 100000));

    // Always idempotently ensure the treasury's token account exists. No-op if it
    // already does; otherwise the sender pays ~0.002 SOL rent to create it once.
    tx.add(createAtaIdempotentInstruction(web3, sender, treasury, mint));

    tx.add(new web3.TransactionInstruction({
      programId: pk.TOKEN,
      keys: [
        { pubkey: sourceATA, isSigner: false, isWritable: true  },
        { pubkey: destATA,   isSigner: false, isWritable: true  },
        { pubkey: sender,    isSigner: true,  isWritable: false },
      ],
      data: encodeTransferData(rawAmount),
    }));

    return { tx: tx, connection: connection, blockhashInfo: latest };
  }

  async function sendAndConfirm(connection, phantom, tx, blockhashInfo, onProgress) {
    var result = await phantom.signAndSendTransaction(tx);
    var sig    = result.signature;
    if (onProgress) onProgress({ stage: 'sent', sig: sig });

    // Poll getSignatureStatus with searchTransactionHistory:true so we search
    // across all nodes — not just the local RPC node's memory cache, which is
    // what caused "confirmed" to hang forever on the public devnet RPC.
    var deadline = Date.now() + 90000; // 90s — devnet can be slow
    while (Date.now() < deadline) {
      try {
        var resp = await connection.getSignatureStatus(sig, { searchTransactionHistory: true });
        if (resp && resp.value) {
          if (resp.value.err) {
            throw new Error('Transaction failed on-chain: ' + JSON.stringify(resp.value.err));
          }
          var conf = resp.value.confirmationStatus;
          if (conf === 'confirmed' || conf === 'finalized') return sig;
        }
      } catch (e) {
        // Only re-throw real failures — ignore transient RPC errors and retry.
        if (e.message && e.message.indexOf('Transaction failed') === 0) throw e;
      }
      await new Promise(function (r) { setTimeout(r, 2000); });
    }
    throw new Error('Timed out waiting for confirmation. Check the explorer for sig: ' + sig);
  }

  function explorerUrl(sig) {
    return CFG.EXPLORER_BASE + sig + (CFG.EXPLORER_SUFFIX || '');
  }

  // ── Core: send a USD-denominated amount to the treasury ─────────────────────────
  // Internal. Resolves to a tx signature or throws.
  async function sendUsd(totalUsd, token, onProgress) {
    if (onProgress) onProgress({ stage: 'connecting' });
    var web3 = await loadWeb3();
    if (!isConnected()) await connect();
    var phantom = getPhantom();

    var mintStr, decimals, pricePerToken;
    if (token === 'TROLL') {
      mintStr       = CFG.TROLL_MINT;
      decimals      = CFG.TROLL_DECIMALS;
      pricePerToken = await fetchTrollPrice();
    } else {
      mintStr       = CFG.USDC_MINT;
      decimals      = CFG.USDC_DECIMALS;
      pricePerToken = 1; // 1 USDC = $1.00
    }

    if (onProgress) onProgress({ stage: 'building' });
    var rawAmount = toRawUnits(totalUsd, pricePerToken, decimals);
    var built     = await buildTransferTx(web3, _wallet.address, mintStr, rawAmount);

    if (onProgress) onProgress({ stage: 'awaiting' });
    return sendAndConfirm(built.connection, phantom, built.tx, built.blockhashInfo, function (ev) {
      if (ev.stage === 'sent' && onProgress) onProgress({ stage: 'confirming', sig: ev.sig });
    });
  }

  // ── Public: generic payment ──────────────────────────────────────────────────────
  // pay({ amountUsd, token?, taxRate?, onProgress? })
  //   amountUsd : base amount in USD (required)
  //   token     : 'USDC' (default) or 'TROLL' (falls back to USDC if unavailable)
  //   taxRate   : fraction added on top (default 0 — e.g. 0.069 for a 6.9% tax)
  //   onProgress: ({stage, sig?}) callback
  // Returns { ok:true, txSig, base, tax, total } or { ok:false, reason }.
  async function pay(opts) {
    opts = opts || {};
    var base  = Number(opts.amountUsd);
    if (!(base > 0)) return { ok: false, reason: 'Enter an amount' };
    var token = (opts.token === 'TROLL' && trollAvailable()) ? 'TROLL' : 'USDC';
    var taxRate = Number(opts.taxRate) || 0;
    var tax   = base * taxRate;
    var total = base + tax;
    try {
      var sig = await sendUsd(total, token, opts.onProgress);
      return { ok: true, txSig: sig, base: base, tax: tax, total: total };
    } catch (err) {
      if (window.console) console.error('[TrollPay] payment error:', err);
      return { ok: false, reason: friendlyError(err) };
    }
  }

  // ── Public: convenience revive payment (uses config price + tax) ─────────────────
  async function payForRevive(onProgress) {
    var p = revivePricing();
    var token = getToken();
    try {
      var sig = await sendUsd(p.total, token, onProgress);
      return { ok: true, txSig: sig };
    } catch (err) {
      if (window.console) console.error('[TrollPay] payment error:', err);
      return { ok: false, reason: friendlyError(err) };
    }
  }

  function friendlyError(err) {
    var msg = (err && err.message) || String(err);
    if (/no_token_balance/i.test(msg))            return "You don't hold that token in this wallet";
    if (/reject|cancel|user denied|user rejected/i.test(msg)) return 'Payment cancelled';
    if (/not installed/i.test(msg))               return 'Phantom not found';
    if (/insufficient|0x1\b|debit an account/i.test(msg)) return 'Insufficient funds';
    if (/price feed|TROLL price|not configured/i.test(msg)) return '$TROLL price unavailable';
    if (/timed out|expired|blockhash/i.test(msg)) return 'Timed out — try again';
    if (/failed to fetch|networkerror|load failed|could not load/i.test(msg)) return 'Network error — check connection & retry';
    return 'Payment failed: ' + msg.slice(0, 120);
  }

  // ── Optional UI helper: token picker ───────────────────────────────────────────
  // Renders into `el` a tiny USDC / $TROLL selector. When only USDC is available
  // (devnet, or $TROLL mint unset) it renders a static "Paying in USDC" label.
  // Optional onChange(token) fires whenever the selection changes (and once on
  // mount), so callers can refresh their own labels.
  function mountTokenPicker(el, onChange) {
    if (!el) return;
    el.innerHTML = '';
    if (!trollAvailable()) {
      var span = document.createElement('span');
      span.className = 'pay-token-static';
      span.textContent = 'Paying in USDC';
      el.appendChild(span);
      setToken('USDC');
      if (onChange) onChange('USDC');
      return;
    }
    ['USDC', 'TROLL'].forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pay-token-btn' + (t === _token ? ' is-active' : '');
      b.textContent = t === 'TROLL' ? '$TROLL' : 'USDC';
      b.addEventListener('click', function () {
        setToken(t);
        el.querySelectorAll('.pay-token-btn').forEach(function (n) { n.classList.remove('is-active'); });
        b.classList.add('is-active');
        if (onChange) onChange(_token);
      });
      el.appendChild(b);
    });
  }

  // ── Mobile: Solana Pay handoff ─────────────────────────────────────────────
  // A phone's normal browser has no injected wallet, so instead of connecting we
  // hand off to the Phantom app with a Solana Pay transfer-request URL. Phantom
  // opens straight to an approve screen for the exact amount + token. There is no
  // automatic return to the site (by design).
  function isTouchMobile() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') ||
           (('ontouchstart' in window) && Math.min(screen.width || 9999, screen.height || 9999) < 820);
  }
  // True when we should hand off to the Phantom app (mobile, no injected wallet).
  function shouldUseSolanaPay() {
    return !getPhantom() && isTouchMobile();
  }
  function trimAmount(n, decimals) {
    return Number(n).toFixed(decimals).replace(/\.?0+$/, '');
  }
  // Build a Solana Pay transfer-request URL for `amountUsd` in the chosen token.
  async function solanaPayUrl(opts) {
    opts = opts || {};
    var base = Number(opts.amountUsd);
    if (!(base > 0)) throw new Error('Enter an amount');
    var token = (opts.token === 'TROLL' && trollAvailable()) ? 'TROLL' : 'USDC';
    var mint, amount, decimals;
    if (token === 'TROLL') {
      var price = await fetchTrollPrice();
      amount   = base / price;          // USD → token units
      mint     = CFG.TROLL_MINT;
      decimals = CFG.TROLL_DECIMALS;
    } else {
      amount   = base;                  // USDC is 1:1
      mint     = CFG.USDC_MINT;
      decimals = CFG.USDC_DECIMALS;
    }
    var params = new URLSearchParams();
    params.set('amount', trimAmount(amount, Math.min(decimals, 6)));
    params.set('spl-token', mint);
    params.set('label', opts.label || 'Troll Fund');
    params.set('message', opts.message || 'Tip the Troll Runner');
    return 'solana:' + CFG.TREASURY_WALLET + '?' + params.toString();
  }

  // ── Mobile confirmation: poll the treasury for an incoming payment ───────────
  // The Solana Pay handoff gives no callback, so for actions that must be
  // confirmed (game revives), we snapshot the treasury's latest tx before paying,
  // then poll until a NEW one lands. Matching is loose (any new incoming tx on the
  // treasury's token account) which is fine for low-traffic games — the player
  // paid regardless. Uses plain JSON-RPC (no web3 needed for these reads).
  function makeSignal(ms) {
    return typeof AbortSignal !== 'undefined' && AbortSignal.timeout
      ? AbortSignal.timeout(ms) : undefined;
  }
  async function rpcCall(method, params) {
    var resp = await fetch(CFG.SOLANA_RPC, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params }),
      signal: makeSignal(15000),
    });
    var json = await resp.json();
    if (json.error) throw new Error(json.error.message || 'RPC error');
    return json.result;
  }
  function mintForToken(token) {
    return (token === 'TROLL' && trollAvailable()) ? CFG.TROLL_MINT : CFG.USDC_MINT;
  }
  async function treasuryAta(token) {
    var res = await rpcCall('getTokenAccountsByOwner',
      [CFG.TREASURY_WALLET, { mint: mintForToken(token) }, { encoding: 'jsonParsed' }]);
    return (res && res.value && res.value[0] && res.value[0].pubkey) || null;
  }
  // Most recent signature on the treasury's token account (snapshot baseline).
  async function latestTreasurySig(token) {
    var ata = await treasuryAta(token);
    if (!ata) return null;
    var sigs = await rpcCall('getSignaturesForAddress', [ata, { limit: 1 }]);
    return (sigs && sigs[0] && sigs[0].signature) || null;
  }
  // Poll until a signature newer than `sinceSig` lands. Resolves { ok, sig }.
  async function waitForNewTreasuryPayment(token, sinceSig, timeoutMs, onTick) {
    var ata = await treasuryAta(token);
    if (!ata) return { ok: false, reason: 'No treasury account' };
    var deadline = Date.now() + (timeoutMs || 120000);
    while (Date.now() < deadline) {
      try {
        var sigs = await rpcCall('getSignaturesForAddress', [ata, { limit: 5 }]);
        if (sigs && sigs.length) {
          var top = sigs[0];
          if (top.signature !== sinceSig && !(top.err)) return { ok: true, sig: top.signature };
        }
      } catch (e) { /* transient — keep polling */ }
      if (onTick) onTick();
      await new Promise(function (r) { setTimeout(r, 3000); });
    }
    return { ok: false, reason: 'timeout' };
  }

  window.TrollPay = {
    loadWeb3:          loadWeb3,
    connect:           connect,
    isConnected:       isConnected,
    getWallet:         getWallet,
    trollAvailable:    trollAvailable,
    setToken:          setToken,
    getToken:          getToken,
    pay:               pay,
    payForRevive:      payForRevive,
    costLabel:         costLabel,
    explorerUrl:       explorerUrl,
    mountTokenPicker:  mountTokenPicker,
    isTouchMobile:     isTouchMobile,
    shouldUseSolanaPay: shouldUseSolanaPay,
    solanaPayUrl:      solanaPayUrl,
    warmTrollPrice:    warmTrollPrice,
    latestTreasurySig: latestTreasurySig,
    waitForNewTreasuryPayment: waitForNewTreasuryPayment,
    config:            CFG,
  };
})();
