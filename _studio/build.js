'use strict';
// PRINTER PAD brand kit — STBL monochrome (pure black & white), pixel banknote mark,
// Press Start 2P / JetBrains Mono. Core message: THE FIRST LAUNCHPAD ON STABLE CHAIN.
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">`;

const BASE = `
:root{--bg:#000;--ink:#fff;--sub:#a6a6a6;--mut:#6a6a6a;--line:rgba(255,255,255,.12);--line2:rgba(255,255,255,.24);
  --card:#0a0a0a;--card2:#121212}
*{margin:0;padding:0;box-sizing:border-box}
html,body{font-family:'JetBrains Mono',ui-monospace,monospace;color:var(--ink);background:var(--bg);overflow:hidden;-webkit-font-smoothing:antialiased}
.stage{position:relative;overflow:hidden;background:var(--bg)}
.px{font-family:'Press Start 2P',monospace;font-weight:400}
.dither{position:absolute;pointer-events:none;background-image:radial-gradient(circle,rgba(255,255,255,.4) 1px,transparent 1.4px);background-size:9px 9px;opacity:.16}
`;

// pixel banknote mark: note frame + $ center + corner marks
function note(w, glow) {
  const h = Math.round(w * .56);
  return `<svg width="${w}" height="${h}" viewBox="0 0 32 18" shape-rendering="crispEdges" style="image-rendering:pixelated${glow ? ';filter:drop-shadow(0 0 ' + Math.round(w * .06) + 'px rgba(255,255,255,.55))' : ''}" xmlns="http://www.w3.org/2000/svg"><g fill="#fff">
    <rect x="0" y="0" width="32" height="2"/><rect x="0" y="16" width="32" height="2"/>
    <rect x="0" y="2" width="2" height="14"/><rect x="30" y="2" width="2" height="14"/>
    <rect x="4" y="4" width="2" height="2"/><rect x="26" y="4" width="2" height="2"/>
    <rect x="4" y="12" width="2" height="2"/><rect x="26" y="12" width="2" height="2"/>
    <rect x="12" y="5" width="7" height="2"/><rect x="11" y="7" width="3" height="2"/>
    <rect x="12" y="9" width="7" height="2"/><rect x="18" y="11" width="3" height="2"/>
    <rect x="12" y="13" width="7" height="2"/>
    <rect x="15" y="3" width="2" height="2"/><rect x="15" y="13" width="2" height="2"/>
  </g></svg>`;
}
function wordmark(fontPx) {
  return `<div style="display:flex;align-items:center;justify-content:center;gap:${Math.round(fontPx * .5)}px" class="px">
    <span style="font-size:${fontPx}px">PRINTER</span>${note(Math.round(fontPx * 1.7), true)}<span style="font-size:${fontPx}px">PAD</span></div>`;
}
const chip = (t, invert) => `<span style="display:inline-flex;align-items:center;font-family:'JetBrains Mono',monospace;font-size:25px;font-weight:700;color:${invert ? '#000' : 'var(--ink)'};background:${invert ? '#fff' : 'var(--card)'};border:1px solid ${invert ? '#fff' : 'var(--line2)'};border-radius:999px;padding:13px 28px;letter-spacing:.04em">${t}</span>`;
const dithers = `
  <div class="dither" style="top:-4%;right:-6%;width:50%;height:46%;-webkit-mask-image:radial-gradient(60% 60% at 70% 30%,#000,transparent 72%);mask-image:radial-gradient(60% 60% at 70% 30%,#000,transparent 72%)"></div>
  <div class="dither" style="bottom:-8%;left:-6%;width:48%;height:50%;opacity:.1;-webkit-mask-image:radial-gradient(55% 55% at 30% 70%,#000,transparent 70%);mask-image:radial-gradient(55% 55% at 30% 70%,#000,transparent 70%)"></div>`;

function page(w, h, css, inner) {
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE}
  .stage{width:${w}px;height:${h}px}${css}</style></head>
  <body><div class="stage">${dithers}${inner}</div></body></html>`;
}

const assets = {};

// 1) PFP 2000²
assets['printerpad-pfp'] = page(2000, 2000, `
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:90px}
  .tick{font-size:62px;font-weight:700;color:var(--ink);letter-spacing:.06em}
  .tag{font-size:40px;color:var(--sub)}`,
  `<div class="wrap">
     ${note(860, true)}
     ${wordmark(96)}
     <div style="text-align:center">
       <div class="tick">$PRINT</div>
       <div class="tag" style="margin-top:26px">the FIRST launchpad on Stable chain</div>
     </div>
   </div>`);

// 2) BANNER 3000×1000
assets['printerpad-banner'] = page(3000, 1000, `
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:52px}
  .tag{font-family:'Inter';font-weight:600;font-size:42px;color:var(--sub);max-width:2100px;text-align:center}
  .tag b{color:var(--ink)}
  .row{display:flex;gap:22px}`,
  `<div class="wrap">
     ${wordmark(84)}
     <div class="tag">The <b>FIRST launchpad on Stable</b> — Tether&rsquo;s USDT chain. Launch tech, launch memes, get paid in dollars. <b>$PRINT powers the pad.</b></div>
     <div class="row">${chip('FIRST ON STABLE CHAIN', true)}${chip('USDT0 GAS · DOLLAR RAILS')}${chip('$PRINT', true)}</div>
     <div style="font-size:30px;color:var(--mut);letter-spacing:2px;font-weight:700">printerpad.fun · @PrinterPadSTBL · CHAIN ID 988</div>
   </div>`);

// 3) KEYART 2400×1350 — the claim
assets['printerpad-first'] = page(2400, 1350, `
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:56px;text-align:center}
  .h{font-size:64px;line-height:1.55;letter-spacing:1px}
  .h .w{color:var(--ink);text-shadow:0 0 40px rgba(255,255,255,.4)}
  .h .m{color:var(--mut)}
  .sub{font-family:'Inter';font-weight:600;font-size:33px;color:var(--sub);max-width:1560px;line-height:1.65}
  .sub b{color:var(--ink)}
  .foot{font-size:27px;color:var(--ink);letter-spacing:2px;font-weight:700}`,
  `<div class="wrap">
     ${wordmark(50)}
     <div class="h px"><span class="m">EVERY CHAIN HAS A LAUNCHPAD.</span><br><span class="w">STABLE JUST GOT ITS FIRST.</span></div>
     <div class="sub">Stable is <b>Tether&rsquo;s new chain</b> — gas in USDT0, dollar-denominated fees, built for payments. Someone had to build the launchpad. <b>We got here first.</b></div>
     <div class="foot">printerpad.fun · @PrinterPadSTBL · $PRINT</div>
   </div>`);

// 4) THE CHAIN 2400×1350 — why Stable matters
const cell = (k, v, d) => `<div style="background:var(--card);border:1px solid var(--line2);border-radius:18px;padding:44px 40px;flex:1">
  <div class="px" style="font-size:15px;color:var(--mut);letter-spacing:2px">${k}</div>
  <div class="px" style="font-size:38px;margin:22px 0 16px">${v}</div>
  <div style="font-family:'Inter';font-weight:500;font-size:22px;color:var(--sub);line-height:1.6">${d}</div></div>`;
assets['printerpad-chain'] = page(2400, 1350, `
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 130px;gap:48px}
  .head{text-align:center}
  .eye{font-size:20px;color:var(--sub);letter-spacing:6px;font-weight:700;margin-bottom:24px}
  .h{font-size:44px;line-height:1.5}
  .row{display:flex;gap:26px}
  .foot{font-size:25px;color:var(--mut);text-align:center;letter-spacing:1px}
  .foot b{color:var(--ink);font-weight:700}`,
  `<div class="wrap">
     <div class="head"><div class="eye">◆ THE CHAIN ◆</div>
       <div class="h px">TETHER BUILT THE RAILS.<br>WE BUILT THE PAD.</div></div>
     <div class="row">
       ${cell('BACKED BY', 'TETHER', 'Stable is the USDT-native L1 from the Tether/Bitfinex universe. The biggest stablecoin on earth, with its own chain.')}
       ${cell('GAS TOKEN', 'USDT0', 'Fees are paid in dollars — predictable, sub-cent, no volatile gas token. Built for real payments volume.')}
       ${cell('FINALITY', '~0.7s', 'Sub-second blocks, full EVM. Everything a launchpad needs, nothing it doesn&rsquo;t.')}
       ${cell('LAUNCHPADS', '1', 'Ours. Chain ID 988 is brand new — being first is the entire trade.')}
     </div>
     <div class="foot">the first launchpad on Stable chain · <b>printerpad.fun</b> · @PrinterPadSTBL · $PRINT</div>
   </div>`);

// 5) HOW 2400×1350 — what the pad does
assets['printerpad-how'] = page(2400, 1350, `
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 130px;gap:48px}
  .head{text-align:center}
  .eye{font-size:20px;color:var(--sub);letter-spacing:6px;font-weight:700;margin-bottom:24px}
  .h{font-size:40px;line-height:1.55}
  .row{display:flex;gap:26px}
  .foot{font-size:25px;color:var(--mut);text-align:center;letter-spacing:1px}
  .foot b{color:var(--ink);font-weight:700}`,
  `<div class="wrap">
     <div class="head"><div class="eye">◆ THE PAD ◆</div>
       <div class="h px">LAUNCH TECH. LAUNCH MEMES.<br>GET PAID EITHER WAY.</div></div>
     <div class="row">
       ${cell('01', 'CLAIM', 'Claim your ticker and launch in minutes — tech coins with verified sites earn the highest creator rewards.')}
       ${cell('02', 'NO DUPES', 'Memes need an original PFP — duplicates are banned at the gate. Every launch is a first.')}
       ${cell('03', 'THE VAULT', 'Every coin gets an LP staking pool. Stake the pad, earn the pad.')}
       ${cell('04', 'CASHBACK', 'Launch fees flow back — creators earn on every coin their launch prints.')}
     </div>
     <div class="foot">$PRINT powers the pad · <b>printerpad.fun</b> · @PrinterPadSTBL · CHAIN ID 988</div>
   </div>`);

for (const [name, html] of Object.entries(assets)) {
  fs.writeFileSync(path.join(OUT, name + '.html'), html);
  console.log('wrote', name + '.html');
}
