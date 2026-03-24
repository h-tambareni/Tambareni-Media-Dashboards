import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine, LabelList } from "recharts";
import { useYouTubeContext } from "./context/YouTubeContext";
import { isSupabaseConfigured } from "./lib/supabase";
import { getInstagramToken } from "./lib/instagramApi";
import {
  fetchBrandsWithChannels,
  createBrand as dbCreateBrand,
  deleteBrand as dbDeleteBrand,
  addChannelToBrand as dbAddChannelToBrand,
  removeChannelFromBrand as dbRemoveChannelFromBrand,
  toggleChannelActive as dbToggleChannelActive,
  fetchLastSyncTime,
  upsertLastManualSync,
  ck, pk,
} from "./lib/supabaseDb";

/** Keeps `limit` channel fetches in flight until all complete (vs waiting for whole batches). */
async function runWithConcurrency(items, limit, fn) {
  const ret = new Array(items.length);
  let next = 0;
  const n = items.length;
  const workers = Math.min(Math.max(1, limit), n || 1);
  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= n) break;
      ret[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return ret;
}

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500;600&display=swap');`;

const css = `
* { box-sizing: border-box; margin: 0; padding: 0; }
.app, .app * { cursor: default; user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; }
.app input, .app textarea, .app select { cursor: text; user-select: text; -webkit-user-select: text; -moz-user-select: text; -ms-user-select: text; }
.app button, .app .nav-item, .app .brand-item, .app .ibtn, .app .tbtn, .app .bcard, .app .pcard, .app .ptab, .app .addbtn, .app .pact, .app a.ibtn { cursor: pointer; }
:root {
  --bg: #080808; --surface: #111111; --surface2: #181818;
  --border: #1e1e1e; --border2: #2e2e2e;
  --text: #f5f2ed; --text2: #d8d4ce; --text3: #b0ada8;
  --red: #d63031; --red-dim: rgba(214,48,49,0.1); 
  --green: #00b894; --green-dim: rgba(0,184,148,0.1);
  --mono: 'DM Mono', monospace; --sans: 'DM Sans', sans-serif; --display: 'Bebas Neue', sans-serif;
}
.app { font-family: var(--sans); background: var(--bg); min-height: 100vh; color: var(--text); display: flex; font-size: 14px; }
/* Sleek dark scrollbars */
.app, .app .sidebar, .app .main, .app .page, .app .bgrid, .app .panel, .app .page-fit { scrollbar-width: thin; scrollbar-color: #333 var(--surface); }
.app ::-webkit-scrollbar, .app .sidebar::-webkit-scrollbar, .app .main::-webkit-scrollbar { width: 6px; height: 6px; }
.app ::-webkit-scrollbar-track { background: var(--surface); }
.app ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
.app ::-webkit-scrollbar-thumb:hover { background: #444; }
.app ::-webkit-scrollbar-thumb:active { background: #555; }
.sidebar { width: 216px; min-height: 100vh; background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; flex-shrink: 0; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
.logo-area { padding: 22px 18px 18px; border-bottom: 1px solid var(--border); }
.logo-text { font-family: var(--display); font-size: 28px; letter-spacing: 3px; line-height: 1.2; color: var(--text); cursor: default; user-select: none; }
.nav-sec { padding: 12px 0; border-bottom: 1px solid var(--border); }
.nav-lbl { font-family: var(--display); font-size: 20px; color: var(--text); letter-spacing: 2px; padding: 0 18px 8px; text-transform: uppercase; cursor: default; user-select: none; }
.nav-item { display: flex; align-items: center; gap: 9px; padding: 8px 18px; cursor: pointer; font-size: 14px; color: var(--text2); transition: all .12s; position: relative; }
.nav-item:hover { color: var(--text); background: var(--surface2); }
.nav-item.act { color: var(--text); background: var(--surface2); }
.nav-item.act::before { content:''; position:absolute; left:0; top:0; bottom:0; width:2px; background:var(--red); }
.nav-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.brand-item { display:flex; align-items:center; gap:9px; padding:7px 18px; cursor:pointer; font-size:13px; color:var(--text2); transition:all .12s; }
.brand-item:hover { color:var(--text); background:var(--surface2); }
.brand-item.act { color:var(--text); }
.b-avatar { width:22px; height:22px; border-radius:3px; display:flex; align-items:center; justify-content:center; font-family:var(--display); font-size:11px; flex-shrink:0; }
.rbadge { background:var(--red); color:white; font-family:var(--mono); font-size:8px; padding:1px 4px; border-radius:2px; margin-left:auto; }
.dbadge { background:#1a1a1a; color:var(--text3); font-family:var(--mono); font-size:8px; padding:1px 4px; border-radius:2px; margin-left:auto; }
.main { flex:1; overflow-x:hidden; overflow-y:auto; min-width:0; height:100vh; }
.topbar { height:48px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; padding:0 24px; background:var(--surface); position:sticky; top:0; z-index:10; }
.topbar-title { font-family:var(--display); font-size:20px; letter-spacing:2px; color:var(--text); cursor:default; user-select:none; }
.tr { display:flex; align-items:center; gap:10px; }
.tpill { display:flex; background:var(--surface2); border:1px solid var(--border2); border-radius:3px; overflow:hidden; }
.tbtn { font-family:var(--mono); font-size:11px; padding:6px 12px; cursor:pointer; color:var(--text2); border:none; background:transparent; transition:all .12s; }
.tbtn.act { background:var(--red); color:white; }
.ibtn { font-family:var(--mono); font-size:10px; padding:5px 12px; background:transparent; border:1px solid var(--border2); color:var(--text2); border-radius:3px; cursor:pointer; transition:all .12s; }
.ibtn:hover { color:var(--text); border-color:var(--text3); }
.ibtn.primary { background:var(--red); border-color:var(--red); color:white; }
.ibtn.danger { color:#e17055; border-color:rgba(225,112,85,.25); }
.ibtn.danger:hover { background:rgba(225,112,85,.1); }
.page { padding:16px 24px; }
.page-fit { display:flex; flex-direction:column; height:calc(100vh - 48px); overflow:hidden; }
.page-fit > * { flex-shrink:0; }
.page-fit .bgrid { flex:1; min-height:0; overflow-y:auto; align-content:start; }
.krow { display:grid; gap:1px; background:var(--border); border:1px solid var(--border); border-radius:5px; overflow:hidden; margin-bottom:12px; }
.kcard { background:var(--surface); padding:16px 20px; }
.klbl { font-family:var(--mono); font-size:11px; color:var(--text2); letter-spacing:2px; text-transform:uppercase; margin-bottom:6px; }
.kval { font-family:var(--display); font-size:64px; letter-spacing:1px; line-height:1; color:var(--text); }
.ksub { font-family:var(--mono); font-size:10px; color:var(--text2); margin-top:3px; }
.kchg { font-family:var(--mono); font-size:9px; margin-top:3px; }
.up { color:var(--green); } .dn { color:var(--red); }
.g3 { display:grid; grid-template-columns:2fr 1fr 1fr; gap:12px; margin-bottom:12px; height:340px; flex-shrink:0; }
.panel { background:var(--surface); border:1px solid var(--border); border-radius:5px; padding:14px 16px; overflow:hidden; min-height:0; }
.ph { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
.ptitle { font-family:var(--display); font-size:14px; letter-spacing:2px; color:var(--text); cursor:default; user-select:none; }
.pact { font-family:var(--mono); font-size:9px; color:var(--text3); cursor:pointer; }
.alert { background:var(--red-dim); border:1px solid var(--red); border-radius:5px; padding:12px 16px; margin-bottom:18px; display:flex; align-items:center; gap:12px; }
.alert-txt { font-size:12px; flex:1; }
.alert-txt strong { color:var(--red); }
.bgrid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:10px; }
.bcard { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:10px 12px; cursor:pointer; transition:all .18s; position:relative; overflow:hidden; }
.bcard:hover { border-color:var(--border2); transform:translateY(-1px); }
.bcard.dead { opacity:.4; cursor:default; }
.bcard-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
.bcard-name { font-family:var(--display); font-size:16px; letter-spacing:1px; }
.bstatus { font-family:var(--mono); font-size:7px; padding:2px 5px; border-radius:2px; text-transform:uppercase; letter-spacing:1px; }
.s-active { background:var(--green-dim); color:var(--green); }
.s-dead { background:var(--red-dim); color:var(--red); }
.bstats { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
.mstat-val { font-family:var(--display); font-size:17px; }
.mstat-lbl { font-family:var(--mono); font-size:7px; color:var(--text3); letter-spacing:1px; text-transform:uppercase; margin-top:1px; }
.ptabs { display:flex; border-bottom:1px solid var(--border); margin-bottom:18px; }
.ptab { font-family:var(--mono); font-size:11px; letter-spacing:1px; padding:9px 18px; cursor:pointer; color:var(--text2); border-bottom:2px solid transparent; margin-bottom:-1px; transition:all .12s; display:flex; align-items:center; gap:7px; }
.ptab:hover { color:var(--text); }
.ptab.act { color:var(--text); border-bottom-color:var(--red); }
.pgrid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
.pcard { background:var(--surface2); border:1px solid var(--border); border-radius:4px; overflow:hidden; cursor:pointer; transition:all .12s; display:flex; flex-direction:row; }
.pcard:hover { border-color:var(--border2); }
.pcard.ba { border-color:rgba(214,48,49,.35); }
.pthumb { width:33%; flex-shrink:0; min-height:200px; background:#161616; display:flex; align-items:center; justify-content:center; font-size:26px; position:relative; overflow:hidden; }
.bab { position:absolute; top:5px; right:5px; background:var(--red); font-family:var(--mono); font-size:7px; padding:2px 4px; border-radius:2px; color:white; }
.pbody { flex:1; min-width:0; padding:12px 14px; display:flex; flex-direction:column; justify-content:flex-start; }
.pcap { font-size:11px; color:var(--text2); margin-bottom:8px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.pvbig { font-family:var(--display); font-size:24px; letter-spacing:1px; color:var(--text); margin-bottom:10px; }
.psr { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:auto; flex-wrap:wrap; }
.psr-left { display:flex; align-items:center; gap:14px; }
.pst { font-family:var(--display); font-size:18px; letter-spacing:1px; color:var(--text3); display:flex; align-items:center; gap:4px; }
.pst span { color:var(--text2); font-family:var(--display); font-size:18px; letter-spacing:1px; }
.pst-lv { font-family:var(--display); font-size:18px; letter-spacing:1px; color:var(--text2); flex-shrink:0; }
.arow { display:flex; align-items:center; gap:10px; padding:12px 14px; background:var(--surface); border:1px solid var(--border); border-radius:4px; margin-bottom:5px; }
.picon { width:28px; height:28px; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:13px; flex-shrink:0; }
.pig { background:linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045); }
.pyt { background:#ff0000; }
.ptt { background:#010101; border:1px solid #2a2a2a; }
.ainfo { flex:1; }
.ahandle { font-size:12px; font-weight:500; }
.atag { font-family:var(--mono); font-size:9px; color:var(--text3); margin-top:1px; }
.ameta { font-family:var(--mono); font-size:9px; color:var(--text3); text-align:right; line-height:1.6; }
.aacts { display:flex; gap:5px; }
.addbtn { display:flex; align-items:center; gap:7px; padding:10px 14px; border:1px dashed var(--border2); border-radius:4px; cursor:pointer; font-family:var(--mono); font-size:10px; color:var(--text3); transition:all .12s; margin-bottom:5px; }
.addbtn:hover { border-color:var(--text3); color:var(--text2); }
.ovrl { position:fixed; inset:0; background:rgba(0,0,0,.85); z-index:100; display:flex; align-items:center; justify-content:center; }
.modal { background:var(--surface); border:1px solid var(--border2); border-radius:7px; padding:26px; width:440px; }
.mtitle { font-family:var(--display); font-size:21px; letter-spacing:1px; margin-bottom:4px; }
.msub { font-size:11px; color:var(--text3); margin-bottom:18px; }
.fg { margin-bottom:12px; }
.flbl { font-family:var(--mono); font-size:9px; color:var(--text3); letter-spacing:2px; text-transform:uppercase; margin-bottom:5px; display:block; }
.finput, .fselect { width:100%; background:var(--surface2); border:1px solid var(--border2); border-radius:3px; padding:9px 11px; color:var(--text); font-family:var(--sans); font-size:12px; outline:none; }
.finput:focus, .fselect:focus { border-color:var(--text3); }
.macts { display:flex; gap:7px; justify-content:flex-end; margin-top:18px; }
.divider { height:1px; background:var(--border); margin:18px 0; }
.chip { font-family:var(--mono); font-size:8px; padding:2px 5px; border-radius:2px; }
.cig { background:rgba(131,58,180,.2); color:#c77dff; }
.cyt { background:rgba(255,0,0,.15); color:#ff6b6b; }
.ctt { background:rgba(255,255,255,.07); color:#888; }
.cg { background:var(--green-dim); color:var(--green); }
.cr { background:var(--red-dim); color:var(--red); }
.cig-insta { background:rgba(225,48,108,.2); color:#E1306C; }
.hdot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
.hg { background:var(--green); box-shadow:0 0 5px var(--green); }
.hr { background:var(--red); box-shadow:0 0 5px var(--red); }
.hd { background:#333; }
.avgline { display:flex; align-items:center; gap:7px; font-family:var(--mono); font-size:9px; color:var(--text3); margin-bottom:10px; }
.albar { flex:1; height:1px; background:rgba(214,48,49,.3); }
.stitle { font-family:var(--display); font-size:20px; letter-spacing:1px; margin-bottom:3px; color:var(--text); cursor:default; user-select:none; }
.sdesc { font-size:12px; color:var(--text2); margin-bottom:12px; cursor:default; }
.sh { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.sht { font-family:var(--display); font-size:18px; letter-spacing:1px; color:var(--text); cursor:default; user-select:none; }
.ct { font-family:var(--mono); font-size:8px; }

@media (max-height: 800px) {
  .kval { font-size: 42px; }
  .kcard { padding: 10px 14px; }
  .klbl { font-size: 9px; margin-bottom: 3px; }
  .ksub { font-size: 8px; }
  .g3 { height: 280px; gap: 8px; margin-bottom: 8px; }
  .krow { margin-bottom: 8px; }
  .page { padding: 10px 16px; }
  .topbar { height: 40px; }
}

@media (max-height: 660px) {
  .kval { font-size: 32px; }
  .kcard { padding: 8px 10px; }
  .g3 { height: 220px; }
}

@media (max-width: 1200px) {
  .kval { font-size: 48px; }
  .bgrid { grid-template-columns: repeat(2, 1fr); }
  .pgrid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 900px) {
  .kval { font-size: 36px; }
  .g3 { grid-template-columns: 1fr; height: auto; min-height: auto; }
  .bgrid { grid-template-columns: 1fr; }
  .pgrid { grid-template-columns: repeat(2, 1fr); }
}

/* Mobile-only: apply only below 768px, desktop unchanged */
@media (max-width: 768px) {
  .mobile-menu-btn { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border: 1px solid var(--border2); border-radius: 4px; background: var(--surface2); color: var(--text); font-size: 18px; cursor: pointer; flex-shrink: 0; }
  .mobile-topbar { display: flex; align-items: center; gap: 10px; padding: 8px 16px; background: var(--surface); border-bottom: 1px solid var(--border); min-height: 48px; }
  .mobile-topbar-brand { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; overflow: hidden; }
  .mobile-topbar-logo { width: 28px; height: 28px; border-radius: 4px; object-fit: cover; flex-shrink: 0; }
  .mobile-topbar-text { font-family: var(--display); font-size: 11px; letter-spacing: 1px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.1; }
  .mobile-topbar-title { font-family: var(--display); font-size: 12px; letter-spacing: 1px; color: var(--text); flex-shrink: 0; text-align: right; }
  .top-posts-panel { flex: 0 0 auto !important; max-height: 200px; }
  .top-posts-list { max-height: 140px !important; }
  .top-post-row { padding: 4px 6px !important; }
  .sidebar-overlay { display: block; }
  .sidebar { position: fixed; top: 0; left: 0; z-index: 1000; height: 100vh; transform: translateX(-100%); transition: transform 0.25s ease; box-shadow: 4px 0 20px rgba(0,0,0,.5); }
  .sidebar.mobile-open { transform: translateX(0); }
  .sidebar-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 999; opacity: 0; pointer-events: none; transition: opacity 0.2s; }
  .sidebar-overlay.visible { opacity: 1; pointer-events: auto; }
  .main { padding-top: 0; }
  .page { padding: 12px 16px; }
  .topbar { padding: 0 16px; min-height: 44px; flex-wrap: wrap; gap: 8px; }
  .topbar-title { font-size: 14px; letter-spacing: 1px; }
  .krow { grid-template-columns: 1fr 1fr !important; gap: 1px; margin-bottom: 10px; }
  .kcard { padding: 12px 14px; }
  .klbl { font-size: 9px; margin-bottom: 4px; }
  .kval { font-size: 32px; }
  .ksub { font-size: 9px; }
  .g3 { grid-template-columns: 1fr; height: auto; min-height: 0; margin-bottom: 12px; }
  .g3 > .panel:not(.top-posts-panel) { min-height: 180px; }
  .panel { padding: 12px 14px; }
  .ptitle { font-size: 12px; }
  .bgrid { grid-template-columns: 1fr; }
  .bcard { padding: 12px 14px; }
  .bcard-top { flex-wrap: wrap; gap: 8px; }
  .bcard-name { font-size: 14px; }
  .bcard-platforms > div { flex: 1 1 min(100%, 140px) !important; min-width: 0; }
  .pgrid { grid-template-columns: 1fr; }
  .pcard .pthumb { min-height: 160px; width: 33%; font-size: 22px; }
  .pbody { padding: 8px 10px; }
  .pcap { font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pvbig { font-size: 15px; }
  .arow { flex-direction: column; align-items: flex-start; gap: 8px; }
  .ameta { text-align: left; }
  .tr { flex-wrap: wrap; }
  .ibtn { font-size: 9px; padding: 6px 10px; }
  .g2 { display: grid; grid-template-columns: 1fr; gap: 12px; }
  .krow[style*="repeat(5")] { grid-template-columns: 1fr 1fr !important; }
  .modal { width: calc(100vw - 32px); max-width: 400px; margin: 16px; padding: 20px; }
  .ptabs { overflow-x: auto; -webkit-overflow-scrolling: touch; flex-wrap: nowrap; padding-bottom: 4px; }
  .ptab { font-size: 10px; padding: 8px 14px; white-space: nowrap; }
  .alert-txt { font-size: 11px; }
}
@keyframes spin { to { transform: rotate(360deg); } }
.spinner { border:2px solid transparent; border-top-color:currentColor; border-radius:50%; animation:spin .7s linear infinite; flex-shrink:0; }
.sync-loading { display:inline-flex; align-items:center; gap:6px; }
@media (min-width: 769px) {
  .mobile-menu-btn { display: none; }
  .mobile-topbar { display: none; }
  .sidebar-overlay { display: none; }
}
`;

function Spinner({ size = 14 }) {
  const bw = size <= 12 ? 1.5 : 2;
  return <span className="spinner" style={{ width: size, height: size, borderWidth: bw }} />;
}

const fmt = n => {
  if (typeof n === "string") return n;
  if (n >= 1000000) return (n/1000000).toFixed(1)+"M";
  if (n >= 1000) return (n/1000).toFixed(1)+"K";
  return String(n);
};
/** Compact axis/label format: whole numbers only (no decimals). */
const fmtWhole = (n) => {
  if (typeof n === "string") return n;
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  const a = Math.abs(v);
  if (a >= 1000000) return `${Math.round(v / 1000000)}M`;
  if (a >= 1000) return `${Math.round(v / 1000)}K`;
  return String(Math.round(v));
};
const fmtNum = n => {
  if (typeof n === "string") return n;
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString();
};
/** Tooltip / detail: full integer with grouping (not K/M shorthand). */
const fmtExactCount = (n) => {
  if (typeof n === "string") return n;
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v - Math.round(v)) < 1e-6) return Math.round(v).toLocaleString();
  return v.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 });
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fn = () => setReduced(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return reduced;
}

/**
 * Per-channel day-over-day delta from daily_snapshots (total_views is cumulative).
 * First snapshot for a channel contributes 0 (no prior baseline).
 * Implausible jumps (bad API / backfill) are zeroed so the chart isn't dominated by one spike.
 */
function channelDailyGrowthFromSnapshots(rows) {
  const sorted = (rows || []).slice().sort((a, b) => (a.raw || a.d || "").localeCompare(b.raw || b.d || ""));
  const maxCum = sorted.reduce((m, r) => Math.max(m, r.views || 0), 0);
  const out = [];
  sorted.forEach((row, i) => {
    const prevRow = i > 0 ? sorted[i - 1] : null;
    const prevCum = prevRow ? (prevRow.views || 0) : 0;
    const currCum = row.views || 0;
    let dailyGrowth = prevRow ? Math.max(0, currCum - prevCum) : 0;
    // Placeholder zeros then a real cumulative → not "one day" of traffic (baseline / backfill).
    if (prevRow && prevCum <= 0 && currCum > 0) dailyGrowth = 0;
    if (prevRow && prevCum > 0 && currCum >= prevCum) {
      const ratio = currCum / prevCum;
      if (ratio > 25 && prevCum < 2_000_000) dailyGrowth = 0;
      else if (dailyGrowth > 5_000_000 && prevCum < 500_000) dailyGrowth = 0;
    }
    // One day cannot plausibly add most of lifetime cumulative views.
    if (maxCum > 50_000 && dailyGrowth > maxCum * 0.45) dailyGrowth = 0;
    out.push({ row, dailyGrowth });
  });
  return out;
}

/** If one calendar day is wildly above the rest, clip it (fixes legacy bad aggregates in DB). */
function clipAggregateDailySpikes(byDate) {
  const rows = Object.values(byDate);
  if (rows.length < 2) return;
  const sorted = [...rows].sort((a, b) => (a.raw || "").localeCompare(b.raw || ""));
  const growths = sorted.map((r) => r.dailyGrowth).filter((g) => g > 0);
  if (!growths.length) return;
  const asc = [...growths].sort((a, b) => a - b);
  const maxG = asc[asc.length - 1];
  const rest = asc.slice(0, -1);
  const medRest = rest.length ? rest[Math.floor(rest.length / 2)] : 0;
  if (rest.length === 0 && maxG > 400_000) {
    sorted.forEach((r) => {
      if (r.dailyGrowth > 400_000) r.dailyGrowth = 0;
    });
    return;
  }
  const baseline = Math.max(medRest * 25, 300_000);
  if (maxG > baseline * 8) {
    const cap = Math.max(medRest * 15, 300_000);
    sorted.forEach((r) => {
      if (r.dailyGrowth > cap * 2) r.dailyGrowth = cap;
    });
  }
}

/** Concise axis label: M/D without leading zeros (e.g. 3/14). */
function formatAxisDateShort(raw) {
  if (!raw || typeof raw !== "string") return "";
  const parts = raw.slice(0, 10).split("-");
  if (parts.length < 3) return raw;
  const m = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (!m || !day) return raw;
  return `${m}/${day}`;
}

/**
 * Local calendar YYYY-MM-DD (not UTC). Mixing `setDate` + `toISOString().slice(0,10)` was shifting
 * "yesterday" near timezone boundaries — same class of bug as excluding "today" from merges.
 */
function localYyyyMmDd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function localYesterdayYyyyMmDd() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localYyyyMmDd(d);
}

/** Previous local calendar day for YYYY-MM-DD (snapshot at midnight → growth = prior day). */
function previousCalendarDay(yyyyMmDd) {
  const parts = String(yyyyMmDd).slice(0, 10).split("-");
  if (parts.length < 3) return yyyyMmDd;
  const y = +parts[0];
  const m = +parts[1];
  const d = +parts[2];
  if (!y || !m || !d) return yyyyMmDd;
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  const y2 = dt.getFullYear();
  const m2 = String(dt.getMonth() + 1).padStart(2, "0");
  const d2 = String(dt.getDate()).padStart(2, "0");
  return `${y2}-${m2}-${d2}`;
}

/** Map snapshot rows to chart rows: X-axis / labels = calendar day views were earned (day before snapshot date). */
function annotateActivityDates(rows) {
  return (rows || []).map((r) => {
    const snap = r.raw;
    if (!snap || typeof snap !== "string") {
      return { ...r, activityRaw: snap, d: r.d };
    }
    const activityRaw = previousCalendarDay(snap);
    return {
      ...r,
      activityRaw,
      d: formatAxisDateShort(activityRaw),
    };
  });
}

function chartDayKey(r) {
  return r?.activityRaw ?? r?.raw ?? "";
}

/** YYYY-MM-DD: dotted vertical line at this day (to the right = reliable 24h snapshots). VITE_RELIABLE_SNAPSHOTS_SINCE=none hides the line. */
const RELIABLE_SNAPSHOTS_SINCE = (() => {
  const v = (import.meta.env.VITE_RELIABLE_SNAPSHOTS_SINCE ?? "").trim();
  if (v.toLowerCase() === "none") return null;
  if (v) return v;
  return "2026-03-15";
})();

function reliableSnapshotAxisX(viewsData) {
  if (!RELIABLE_SNAPSHOTS_SINCE || !viewsData?.length) return null;
  const row = viewsData.find((r) => r.raw === RELIABLE_SNAPSHOTS_SINCE);
  return chartDayKey(row) || null;
}

/** ~10 readable X ticks; uses chart day key (activity calendar day). */
function dailyGrowthXAxisTicks(rows) {
  if (!rows?.length) return undefined;
  const n = rows.length;
  const first = chartDayKey(rows[0]);
  const last = chartDayKey(rows[n - 1]);
  if (!first || !last) return undefined;
  const spanDays = Math.max(1, (new Date(`${last}T12:00:00Z`) - new Date(`${first}T12:00:00Z`)) / 86400000);
  const TARGET = 10;
  const uniq = (arr) => [...new Set(arr)];

  if (spanDays <= 120) {
    const step = Math.max(1, Math.ceil(n / TARGET));
    const out = [];
    for (let i = 0; i < n; i += step) out.push(chartDayKey(rows[i]));
    if (out[out.length - 1] !== last) out.push(last);
    return uniq(out);
  }

  let lastYm = null;
  const monthTicks = [];
  for (const r of rows) {
    const dayKey = chartDayKey(r);
    const ym = dayKey.slice(0, 7);
    if (ym !== lastYm) {
      lastYm = ym;
      monthTicks.push(dayKey);
    }
  }
  if (monthTicks.length <= TARGET + 2) {
    if (monthTicks[monthTicks.length - 1] !== last) monthTicks.push(last);
    return uniq(monthTicks);
  }
  const mStep = Math.ceil(monthTicks.length / TARGET);
  const out = [];
  for (let i = 0; i < monthTicks.length; i += mStep) out.push(monthTicks[i]);
  if (out[out.length - 1] !== last) out.push(last);
  return uniq(out);
}

function formatDailyGrowthXTick(raw, rows) {
  if (!raw || !rows?.length) return "";
  const first = chartDayKey(rows[0]);
  const last = chartDayKey(rows[rows.length - 1]);
  if (!first || !last) return formatAxisDateShort(raw);
  const t0 = new Date(`${first}T12:00:00Z`).getTime();
  const t1 = new Date(`${last}T12:00:00Z`).getTime();
  const spanDays = Math.max(1, (t1 - t0) / 86400000);
  const y0 = new Date(`${first}T12:00:00Z`).getFullYear();
  const y1 = new Date(`${last}T12:00:00Z`).getFullYear();
  const crossesYears = y0 !== y1;
  const d = new Date(`${raw}T12:00:00Z`);
  if (spanDays <= 120) return formatAxisDateShort(raw);
  if (spanDays <= 400 && !crossesYears) return d.toLocaleString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleString("en-US", { month: "short", year: "2-digit" });
}

/**
 * When one day is a huge outlier vs the rest, cap Y so typical day-to-day differences use more vertical space.
 * The spike may flatten at the top; tooltips still show the true value. Returns null for auto scaling.
 */
function dailyGrowthYAxisDomainMax(rows) {
  const nz = (rows || [])
    .map((r) => Math.max(0, Number(r.views) || 0))
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  if (!nz.length) return null;
  const rawMax = nz[nz.length - 1];
  const secondMax = nz.length >= 2 ? nz[nz.length - 2] : 0;
  const p75 = nz[Math.floor((nz.length - 1) * 0.75)];
  const outlierSpike = secondMax > 0 && rawMax > secondMax * 3;
  if (!outlierSpike) return null;
  const scaleMax = Math.max(p75 * 5, secondMax * 1.15, rawMax * 0.25);
  const cap = Math.min(rawMax, scaleMax);
  const nice = Math.ceil(cap / 5000) * 5000;
  return Math.max(nice, 1000);
}

const DAILY_GROWTH_RANGE_OPTIONS = [
  { id: "all", label: "All time" },
  { id: "ytd", label: "YTD" },
  { id: "1y", label: "1 year" },
  { id: "3m", label: "3 months" },
  { id: "1m", label: "1 month" },
  { id: "1w", label: "1 week" },
];

function getDailyGrowthRangeCutoff(rangeId) {
  if (!rangeId || rangeId === "all") return null;
  const now = new Date();
  if (rangeId === "ytd") return `${now.getFullYear()}-01-01`;
  let daysBack = 365;
  if (rangeId === "1y") daysBack = 365;
  else if (rangeId === "3m") daysBack = 92;
  else if (rangeId === "1m") daysBack = 30;
  else if (rangeId === "1w") daysBack = 7;
  const d = new Date(now.getTime() - daysBack * 86400000);
  return localYyyyMmDd(d);
}

function filterDailyGrowthByRange(rows, rangeId) {
  if (!rows?.length || !rangeId || rangeId === "all") return rows || [];
  const cutoff = getDailyGrowthRangeCutoff(rangeId);
  if (!cutoff) return rows;
  return rows.filter((r) => (r.raw || "") >= cutoff);
}

const WEEKDAY_SHORT_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Local calendar weekday from YYYY-MM-DD (matches how chart dates are interpreted). */
function weekdayIndexLocal(raw) {
  if (!raw || typeof raw !== "string") return 0;
  const parts = raw.slice(0, 10).split("-").map(Number);
  const [y, m, d] = parts;
  if (!y || !m || !d) return 0;
  return new Date(y, m - 1, d).getDay();
}

/** Map Sun=0..Sat=6 → Mon=0 .. Sun=6 */
function mondayFirstSlot(jsWeekday) {
  return jsWeekday === 0 ? 6 : jsWeekday - 1;
}

/**
 * Average daily growth (views) per weekday from the same rows as Daily Growth.
 * Buckets by the calendar day views were earned (activity day), not snapshot DB date.
 */
function buildWeekdayGrowthChartData(rows) {
  const bins = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }));
  for (const row of rows || []) {
    const dayKey = chartDayKey(row);
    if (!dayKey) continue;
    const v = Math.max(0, Number(row.views) || 0);
    const slot = mondayFirstSlot(weekdayIndexLocal(dayKey));
    bins[slot].sum += v;
    bins[slot].n += 1;
  }
  return bins.map((b, i) => ({
    name: WEEKDAY_SHORT_MON[i],
    avg: b.n > 0 ? Math.round(b.sum / b.n) : 0,
    total: b.sum,
    days: b.n,
  }));
}

/** Merge per-channel daily growth into one series. Include today's snapshot row so the latest
 * activity day (e.g. "yesterday" after midnight cron) can render — skipping "today" dropped that delta.
 */
function buildDailyGrowthSeriesFromChannels(channels) {
  const fmtD = formatAxisDateShort;
  const byDate = {};
  (channels || []).forEach((ch) => {
    channelDailyGrowthFromSnapshots(ch.dailyViews || []).forEach(({ row, dailyGrowth }) => {
      const key = row.raw || row.d;
      if (!byDate[key]) byDate[key] = { d: fmtD(key), raw: key, dailyGrowth: 0 };
      byDate[key].dailyGrowth += dailyGrowth;
    });
  });
  clipAggregateDailySpikes(byDate);
  let sorted = Object.values(byDate).sort((a, b) => (a.raw || "").localeCompare(b.raw || ""));
  let runSum = 0;
  sorted.forEach((r) => {
    runSum += r.dailyGrowth;
    r.cumViews = runSum;
  });
  if (sorted.length === 1) {
    const d0 = sorted[0].raw || "";
    const prevStr = d0 ? previousCalendarDay(d0) : localYesterdayYyyyMmDd();
    sorted = [{ d: fmtD(prevStr), raw: prevStr, cumViews: 0 }, ...sorted];
  }
  return fillDailyGrowthGaps(sorted);
}

/** Fill missing days in daily growth data so the chart shows smooth daily points (no gaps). */
function fillDailyGrowthGaps(sorted) {
  if (!sorted?.length) return [];
  const byRaw = Object.fromEntries(sorted.map(r => [r.raw, r]));
  let first = sorted[0].raw;
  let last = sorted[sorted.length - 1].raw;
  const yesterday = localYesterdayYyyyMmDd();
  if (last < yesterday) last = yesterday;
  const result = [];
  let prevCum = 0;
  const startMs = new Date(first + "T12:00:00Z").getTime();
  const endMs = new Date(last + "T12:00:00Z").getTime();
  const dayMs = 86400000;
  for (let t = startMs; t <= endMs; t += dayMs) {
    const d = new Date(t);
    const raw = d.toISOString().slice(0, 10);
    const existing = byRaw[raw];
    const cumViews = existing ? existing.cumViews : prevCum;
    result.push({
      d: formatAxisDateShort(raw),
      raw,
      cumViews,
      views: 0,
    });
    prevCum = cumViews;
  }
  result.forEach((row, i) => {
    row.views = i === 0 ? 0 : Math.max(0, row.cumViews - result[i - 1].cumViews);
  });
  return result;
}

const TTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const displayLabel =
    typeof label === "string" && /^\d{4}-\d{2}-\d{2}$/.test(label)
      ? (() => {
          const [y, mo, da] = label.slice(0, 10).split("-").map(Number);
          return new Date(y, mo - 1, da).toLocaleDateString(undefined, {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
          });
        })()
      : label;
  return (
    <div style={{background:"#1a1a1a",border:"1px solid #2e2e2e",borderRadius:3,padding:"7px 10px",fontFamily:"DM Mono",fontSize:10,color:"#f0ede8"}}>
      <div style={{color:"#555",marginBottom:3,fontSize:9}}>{displayLabel}</div>
      {payload.map((p) => {
        const v = p.payload?.views != null ? p.payload.views : p.value;
        return (
          <div key={p.name} style={{ color: p.color, marginBottom: 1 }}>
            {p.name}: {fmtExactCount(v)}
          </div>
        );
      })}
    </div>
  );
};

const WeekdayGrowthTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "1px solid #2e2e2e",
        borderRadius: 3,
        padding: "7px 10px",
        fontFamily: "DM Mono",
        fontSize: 10,
        color: "#f0ede8",
      }}
    >
      <div style={{ color: "#bbb", marginBottom: 4, fontSize: 10 }}>{p.name}</div>
      <div>Avg / day: {fmtExactCount(p.avg)}</div>
      <div>Total: {fmtExactCount(p.total)}</div>
      <div style={{ color: "#666", fontSize: 9, marginTop: 3 }}>
        {p.days} day{p.days !== 1 ? "s" : ""} in range
      </div>
    </div>
  );
};

function WeekdayGrowthPanel({ data, height, emptyHint, panelStyle }) {
  const hasSamples = (data || []).some((d) => d.days > 0);
  return (
    <div className="panel" style={{ marginBottom: 12, ...panelStyle }}>
      <div className="ph" style={{ marginBottom: 6 }}>
        <span className="ptitle">DAY OF WEEK</span>
      </div>
      {hasSamples ? (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 2 }}>
            <XAxis dataKey="name" tick={{ fontFamily: "DM Mono", fontSize: 9, fill: "#666" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontFamily: "DM Mono", fontSize: 8, fill: "#444" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtWhole}
              width={36}
            />
            <Tooltip content={<WeekdayGrowthTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar dataKey="avg" name="Avg daily growth" fill="#ff6b6b" radius={[3, 3, 0, 0]} maxBarSize={48} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div
          style={{
            height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text3)",
            fontSize: 11,
            fontFamily: "DM Mono",
          }}
        >
          {emptyHint}
        </div>
      )}
    </div>
  );
}

const platEmoji = {youtube:"▶️",tiktok:"🎵"};
const getFollowers = (c) => (c?.platform?.followers ?? c?.channel?.subscribers ?? 0) || 0;
const platColors = {youtube:"#ff6b6b",tiktok:"#69c9d0"};

const fbGradients = [
  "linear-gradient(135deg,#d63031,#e17055)","linear-gradient(135deg,#6c5ce7,#a29bfe)",
  "linear-gradient(135deg,#00b894,#55efc4)","linear-gradient(135deg,#0984e3,#74b9ff)",
  "linear-gradient(135deg,#fdcb6e,#e17055)","linear-gradient(135deg,#e84393,#fd79a8)",
];
const hashStr = (s) => { let h = 0; for (let i = 0; i < (s||"").length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return Math.abs(h); };

function Pfp({ src, srcs, size = 28, fallback, name }) {
  const allSrcs = srcs || (src ? [src] : []);
  const [failed, setFailed] = useState(new Set());
  const activeSrc = allSrcs.find((s, i) => s && !failed.has(i));
  const fb = fallback || (name ? name[0].toUpperCase() : "?");
  const grad = fbGradients[hashStr(name || fb) % fbGradients.length];
  const s = { width: size, height: size, borderRadius: 4, objectFit: "cover", flexShrink: 0 };
  return (
    <div style={{ width: size, height: size, flexShrink: 0 }}>
      {activeSrc ? (
        <img src={activeSrc} alt="" style={s} referrerPolicy="no-referrer" onError={() => setFailed(prev => new Set(prev).add(allSrcs.indexOf(activeSrc)))}/>
      ) : (
        <div style={{ display: "flex", width: size, height: size, borderRadius: 4, alignItems: "center", justifyContent: "center", fontFamily: "var(--display)", fontSize: Math.max(9, size * 0.45), letterSpacing: 1, color: "#fff", background: grad }}>{fb}</div>
      )}
    </div>
  );
}

const digitSpinKeyframes = `@keyframes digitRoll{0%{transform:translateY(0)}100%{transform:translateY(-10em)}}`;
function DigitSlot({ digit, spinning, delay }) {
  const d = Math.min(9, Math.max(0, digit));
  return (
    <span style={{ display: "inline-block", overflow: "hidden", height: "1em", lineHeight: 1, verticalAlign: "bottom" }}>
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          transform: spinning ? undefined : `translateY(-${d}em)`,
          animation: spinning ? `digitRoll 0.08s linear infinite` : "none",
          animationDelay: delay ? `${delay}ms` : undefined,
        }}
      >
        {[0,1,2,3,4,5,6,7,8,9].map(n => <span key={n} style={{ height: "1em", display: "block", textAlign: "center" }}>{n}</span>)}
      </span>
    </span>
  );
}
function RollingNumber({ value, spinning, format = "full", magnitude, skipAnimation }) {
  const num = Math.round(Number(value) || 0);
  const [displayNum, setDisplayNum] = useState(0);
  const rafRef = useRef();
  useEffect(() => {
    if (skipAnimation) return;
    if (spinning) {
      const mag = magnitude ?? Math.pow(10, Math.max(0, Math.floor(Math.log10(num + 1))));
      const id = setInterval(() => setDisplayNum(Math.floor(Math.random() * mag)), 80);
      return () => clearInterval(id);
    }
  }, [skipAnimation, spinning, magnitude, num]);
  useEffect(() => {
    if (skipAnimation) return;
    if (spinning) return;
    const start = 0;
    const end = num;
    const duration = 400;
    const startTime = performance.now();
    const tick = (t) => {
      const elapsed = t - startTime;
      const p = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - p, 2);
      setDisplayNum(Math.round(start + (end - start) * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [skipAnimation, spinning, num]);
  if (skipAnimation) {
    const s = format === "short" ? fmt(num) : fmtNum(num);
    return <span style={{ fontVariantNumeric: "tabular-nums" }}>{s}</span>;
  }
  const displayStr = format === "short" ? fmt(displayNum) : fmtNum(displayNum);
  if (spinning) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", fontVariantNumeric: "tabular-nums" }}>
        <style>{digitSpinKeyframes}</style>
        {displayStr.split("").map((c, i) => {
          const d = parseInt(c, 10);
          if (c === "," || c === "." || isNaN(d)) return <span key={i}>{c}</span>;
          return <DigitSlot key={i} digit={d} spinning delay={i * 15} />;
        })}
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", fontVariantNumeric: "tabular-nums" }}>
      <style>{digitSpinKeyframes}</style>
      {displayStr.split("").map((c, i) => {
        const d = parseInt(c, 10);
        if (c === "," || c === "." || isNaN(d)) return <span key={i}>{c}</span>;
        return <DigitSlot key={i} digit={d} spinning={false} />;
      })}
    </span>
  );
}

function proxyImageUrl(url) {
  if (!url || typeof url !== "string") return url;
  if (!/cdninstagram|fbcdn\.net|scontent/i.test(url)) return url;
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
}

function getChannelThumbs(d) {
  const urls = [];
  const seen = new Set();
  [d?.platform?.thumbnail, d?.channel?.thumbnail].forEach(t => { if (t && !seen.has(t)) { urls.push(proxyImageUrl(t)); seen.add(t); } });
  (d?.posts || []).slice(0, 2).forEach(p => { if (p?.thumbnail && !seen.has(p.thumbnail)) { urls.push(proxyImageUrl(p.thumbnail)); seen.add(p.thumbnail); } });
  return urls;
}
function getAllBrandThumbs(brand, channelData) {
  const urls = [];
  const tried = new Set();
  for (const key of (brand.handles || [])) {
    getChannelThumbs(channelData[key] || {}).forEach(u => { if (u && !tried.has(u)) { urls.push(u); tried.add(u); } });
  }
  return urls;
}

function Overview({ onBrand, brandsFromDb, brandsLoading, syncAll, syncing, syncProgress, syncElapsed, lastSync, syncErrors, onAccounts }) {
  const { channelData } = useYouTubeContext();
  const prefersReducedMotion = usePrefersReducedMotion();
  // Keep digit spin on phones; only skip for accessibility (prefers-reduced-motion).
  const skipNumberAnim = prefersReducedMotion;

  // Include inactive accounts so totals still show last-known flw/views (deactivate = stop syncing, not erase data).
  const uniqueKeys = [...new Set((brandsFromDb || []).flatMap(b => b.handles || []))];
  const allChannelsLoaded = uniqueKeys.length === 0 || uniqueKeys.every(k => channelData[k]);
  const dataReady = !brandsLoading && allChannelsLoaded;
  const showChartsAndBrands = !brandsLoading;
  const keyToBrand = {};
  (brandsFromDb || []).forEach(b => {
    (b.handles || []).forEach(h => {
      if (!keyToBrand[h]) keyToBrand[h] = b.name;
    });
  });
  const allChannels = uniqueKeys.map(h => channelData[h]).filter(Boolean);
  const [dailyGrowthRange, setDailyGrowthRange] = useState(() => {
    try {
      const v = localStorage.getItem("overview-dg-range");
      if (v && DAILY_GROWTH_RANGE_OPTIONS.some((o) => o.id === v)) return v;
    } catch {}
    return "all";
  });
  const persistDailyGrowthRange = useCallback((id) => {
    setDailyGrowthRange(id);
    try {
      localStorage.setItem("overview-dg-range", id);
    } catch {}
  }, []);
  const viewsDataFull = useMemo(() => buildDailyGrowthSeriesFromChannels(allChannels), [allChannels]);
  const viewsData = useMemo(() => {
    const filtered = filterDailyGrowthByRange(viewsDataFull, dailyGrowthRange);
    return annotateActivityDates(filtered);
  }, [viewsDataFull, dailyGrowthRange]);
  const reliableSnapshotLineX = reliableSnapshotAxisX(viewsData);
  const dailyGrowthXTicks = useMemo(() => dailyGrowthXAxisTicks(viewsData), [viewsData]);
  const dailyGrowthYMax = useMemo(() => dailyGrowthYAxisDomainMax(viewsData), [viewsData]);
  const dgLabelFontSize = viewsData.length > 40 ? 6 : viewsData.length > 22 ? 7 : 8;
  const weekdayGrowthData = useMemo(() => buildWeekdayGrowthChartData(viewsData), [viewsData]);

  const totalViews = allChannels.reduce((s, ch) => s + (ch.totalViews || 0), 0);
  const totalFollowers = allChannels.reduce((s, ch) => s + getFollowers(ch), 0);
  const allPostsRaw = uniqueKeys.flatMap(h => {
    const ch = channelData[h];
    return (ch?.posts || []).map(p => ({ ...p, _brand: keyToBrand[h] || "—" }));
  });
  const allPosts = (() => {
    const byId = new Map();
    allPostsRaw.forEach(p => {
      const existing = byId.get(p.id);
      if (!existing || (p.views || 0) > (existing.views || 0)) byId.set(p.id, p);
    });
    return Array.from(byId.values());
  })();
  const avgViews = allPosts.length ? Math.round(allPosts.reduce((s, p) => s + p.views, 0) / allPosts.length) : 0;
  const totalLikes = allPosts.reduce((s, p) => s + (p.likes || 0), 0);
  const totalComments = allPosts.reduce((s, p) => s + (p.cmts || 0), 0);
  const totalShares = allPosts.reduce((s, p) => s + (p.shares || 0), 0);
  const engagementRate = totalViews > 0 ? ((totalLikes + totalComments + totalShares) / totalViews * 100).toFixed(2) : "0";

  let ytViews = 0, ttViews = 0, igViews = 0;
  allChannels.forEach(ch => {
    const pt = ch.platform?.platformType || ch.channel?.platform || "youtube";
    const v = ch.totalViews || 0;
    if (pt === "tiktok") ttViews += v;
    else if (pt === "instagram") igViews += v;
    else ytViews += v;
  });
  const pieData = [];
  if (ytViews > 0) pieData.push({ name: "YT", value: ytViews, color: "#ff6b6b" });
  if (ttViews > 0) pieData.push({ name: "TT", value: ttViews, color: "#69c9d0" });
  if (igViews > 0) pieData.push({ name: "IG", value: igViews, color: "#E1306C" });
  if (!pieData.length) pieData.push({ name: "—", value: 1, color: "#333" });

  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      <div className="topbar">
        <span className="topbar-title">SOCIAL MEDIA ANALYTICS</span>
        <div className="tr" style={{ alignItems: "center", gap: 12 }}>
          {syncing && (
            <>
              {syncProgress.total > 0 && (
                <div className="sync-progress" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 140 }}>
                  <div className="sync-progress-bar-wrap" style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.2)", borderRadius: 3, overflow: "hidden" }}>
                    <div className="sync-progress-bar" style={{ height: "100%", width: `${(syncProgress.completed / syncProgress.total) * 100}%`, background: "var(--accent,#4a9eff)", borderRadius: 3, transition: "width 0.2s" }} />
                  </div>
                  <span style={{ fontSize: 11, whiteSpace: "nowrap" }}>{Math.round((syncProgress.completed / syncProgress.total) * 100)}%</span>
                  <span style={{ fontSize: 11, opacity: 0.9 }}>{syncProgress.completed} / {syncProgress.total} accounts</span>
                </div>
              )}
              <span style={{ fontSize: 11, fontVariantNumeric: "tabular-nums", opacity: 0.9 }}>{Math.floor(syncElapsed / 60)}:{(syncElapsed % 60).toString().padStart(2, "0")}</span>
            </>
          )}
          <button className="ibtn primary" disabled={syncing} onClick={syncAll}>{syncing ? <span className="sync-loading"><Spinner/> SYNCING…</span> : "⟳ SYNC ALL"}</button>
          <button className="ibtn" onClick={onAccounts}>Accounts</button>
        </div>
      </div>
      <div className="page" style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
        <div className="krow" style={{gridTemplateColumns:"repeat(4,1fr)"}}>
          {[
            {l:"Total Views",v:totalViews,s:"All platforms",mag:1e7},
            {l:"Followers",v:totalFollowers,s:"All accounts",mag:1e4},
            {l:"Avg Views/Post",v:avgViews,s:`${allPosts.length} posts`,mag:1e6},
            {l:"Engagement Rate",v:parseFloat(engagementRate)||0,s:"(Likes+cmts+shares)/views",suffix:"%",decimal:true},
          ].map(k=>(
            <div key={k.l} className="kcard">
              <div className="klbl">{k.l}</div>
              <div className="kval">{k.decimal ? (dataReady ? <>{k.v.toFixed(2)}%</> : <><RollingNumber value={Math.floor(k.v)} spinning={!skipNumberAnim && !dataReady} magnitude={10} format="short" skipAnimation={skipNumberAnim} />%</>) : <><RollingNumber value={k.v} spinning={!skipNumberAnim && !dataReady} magnitude={k.mag} format={k.suffix?"short":"full"} skipAnimation={skipNumberAnim} />{k.suffix||""}</>}</div>
              <div className="ksub">{k.s}</div>
            </div>
          ))}
        </div>
        {syncErrors?.length > 0 && (
          <div className="alert" style={{marginTop:8}}>
            <span className="alert-txt"><strong>Sync failed for {syncErrors.length} account{syncErrors.length!==1?"s":""}:</strong> {syncErrors.map(e=>e.key).join(", ")} — {syncErrors[0]?.msg}</span>
          </div>
        )}
        <div className="krow" style={{gridTemplateColumns:"repeat(3,1fr)",marginTop:-4}}>
          {[
            {l:"Total Likes",v:totalLikes,s:"❤️ All content"},
            {l:"Comments",v:totalComments,s:"💬 All content"},
            {l:"Shares",v:totalShares,s:"↗️ All content"},
          ].map(k=>(
            <div key={k.l} className="kcard"><div className="klbl">{k.l}</div><div className="kval"><RollingNumber value={k.v} spinning={!skipNumberAnim && !dataReady} magnitude={1e6} skipAnimation={skipNumberAnim} /></div><div className="ksub">{k.s}</div></div>
          ))}
        </div>

        <div className="g3" style={{visibility: showChartsAndBrands ? "visible" : "hidden", opacity: showChartsAndBrands ? 1 : 0, transition: "opacity 0.25s"}}>
          <div className="panel" style={{display:"flex",flexDirection:"column"}}>
            <div className="ph" style={{ flexShrink: 0, flexWrap: "wrap", alignItems: "center", gap: 8, rowGap: 6 }}>
              <span className="ptitle">DAILY GROWTH</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                {DAILY_GROWTH_RANGE_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className={`tbtn ${dailyGrowthRange === o.id ? "act" : ""}`}
                    style={{ fontSize: 10, padding: "3px 8px" }}
                    onClick={() => persistDailyGrowthRange(o.id)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            {viewsData.length > 0 ? (
              <div style={{flex:1,minHeight:0}}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={viewsData} margin={{ top: 10, right: 32, bottom: 12, left: 2 }}>
                  <defs>
                    <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff6b6b" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#ff6b6b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="activityRaw"
                    ticks={dailyGrowthXTicks}
                    tick={{ fontFamily: "DM Mono", fontSize: 8, fill: "#444" }}
                    tickFormatter={(v) => formatDailyGrowthXTick(v, viewsData)}
                    axisLine={false}
                    tickLine={false}
                    height={26}
                  />
                  <YAxis
                    domain={dailyGrowthYMax != null ? [0, dailyGrowthYMax] : [0, "auto"]}
                    tick={{ fontFamily: "DM Mono", fontSize: 8, fill: "#444" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={fmtWhole}
                    width={40}
                  />
                  <Tooltip content={<TTip/>} cursor={{stroke:"#444",strokeWidth:1}}/>
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke="#ff6b6b"
                    strokeWidth={2}
                    fill="url(#gv)"
                    name="Daily growth"
                    dot={{ r: 3, fill: "#ff6b6b", strokeWidth: 0 }}
                    activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }}
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey="views"
                      position="top"
                      offset={4}
                      formatter={(v) => fmtWhole(v)}
                      style={{ fontFamily: "DM Mono", fontSize: dgLabelFontSize, fill: "#888" }}
                    />
                  </Area>
                  {reliableSnapshotLineX && (
                    <ReferenceLine
                      x={reliableSnapshotLineX}
                      stroke="rgba(245,242,237,0.45)"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      isFront
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
              </div>
            ) : (
              <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text3)",fontSize:12}}>Need 2+ days of data.</div>
            )}
          </div>
          <div className="panel" style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
            <div className="ptitle" style={{alignSelf:"stretch",marginBottom:4,flexShrink:0}}>PLATFORM SPLIT</div>
            <div style={{flex:1,minHeight:0,width:"100%"}}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius="58%" outerRadius="80%" strokeWidth={0}
                  label={({name,percent,cx,cy,midAngle,innerRadius,outerRadius})=>{
                    const R=Math.PI/180; const r=(innerRadius+outerRadius)/2+12;
                    const x=cx+r*Math.cos(-midAngle*R), y=cy+r*Math.sin(-midAngle*R);
                    return <text x={x} y={y} fill="#f5f2ed" textAnchor="middle" dominantBaseline="central" style={{fontSize:11,fontFamily:"DM Mono",fontWeight:500}}>{name} {(percent*100).toFixed(0)}%</text>;
                  }} labelLine={false}
                >
                  {pieData.map((d,i) => <Cell key={i} fill={d.color}/>)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            </div>
          </div>
          <div className="panel top-posts-panel" style={{display:"flex",flexDirection:"column"}}>
            <div className="ptitle" style={{marginBottom:6,flexShrink:0}}>TOP POSTS</div>
            <div className="top-posts-list" style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:4,minHeight:0}}>
              {(() => {
                const ranked = [...allPosts].sort((a,b) => b.views - a.views);
                if (!ranked.length) return <div style={{fontSize:10,color:"var(--text3)",padding:"8px 0"}}>Sync an account to see top posts</div>;
                return ranked.map((p,i) => (
                  <div key={p.id} className="top-post-row" style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:3,padding:"6px 8px",borderLeft:`3px solid ${p.plat==="tt"?"#69c9d0":p.plat==="ig"?"#E1306C":"var(--red)"}`,flexShrink:0}}>
                    <div style={{display:"flex",alignItems:"baseline",gap:5}}>
                      <span style={{fontFamily:"var(--display)",fontSize:13,color:"var(--text3)",minWidth:14}}>#{i+1}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:9,color:"var(--text3)"}}>{p._brand} · {p.plat==="tt"?"🎵":p.plat==="ig"?"📷":"▶️"}</div>
                        <div style={{fontSize:10,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.cap}</div>
                      </div>
                      <span style={{fontFamily:"var(--display)",fontSize:14,color:"var(--text)",flexShrink:0}}>{fmt(p.views)}</span>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>

        <div
          style={{
            visibility: showChartsAndBrands ? "visible" : "hidden",
            opacity: showChartsAndBrands ? 1 : 0,
            transition: "opacity 0.25s",
            flexShrink: 0,
          }}
        >
          <WeekdayGrowthPanel
            data={weekdayGrowthData}
            height={188}
              emptyHint="No data yet."
          />
        </div>

        <div className="sh" style={{marginBottom:6,flexShrink:0,visibility: showChartsAndBrands ? "visible" : "hidden", opacity: showChartsAndBrands ? 1 : 0, transition: "opacity 0.25s"}}>
          <span className="sht">BRANDS</span>
          <span style={{fontFamily:"DM Mono",fontSize:9,color:"var(--text3)"}}>{(brandsFromDb||[]).length} brands</span>
        </div>

        <div className="bgrid" style={{flex:1,minHeight:0,overflowY:"auto",alignContent:"start",visibility: showChartsAndBrands ? "visible" : "hidden", opacity: showChartsAndBrands ? 1 : 0, transition: "opacity 0.25s"}}>
          {!(brandsFromDb||[]).length ? (
            <div style={{gridColumn:"1/-1",textAlign:"center",padding:40,color:"var(--text3)",border:"1px dashed var(--border2)",borderRadius:5}}>
              <div style={{fontSize:14,marginBottom:8}}>No brands yet</div>
              <div style={{fontSize:11}}>Go to <strong>Accounts</strong> → create a brand and sync accounts</div>
            </div>
          ) : (brandsFromDb||[]).map(b => {
            const allHandles = b.handles;
            const chData = allHandles.map(h => channelData[h]).filter(Boolean);
            const brandFollowers = chData.reduce((s, c) => s + getFollowers(c), 0);
            const brandViews = chData.reduce((s, c) => s + (c.totalViews || 0), 0);
            const thumbs = getAllBrandThumbs(b, channelData);
            const hasData = chData.length > 0;
            const allInactive = allHandles.length > 0 && allHandles.every(h => b.handleStatus?.[h] === false);
            const hasTT = allHandles.some(h => (h.includes("::") ? h.split("::")[1] : "youtube") === "tiktok");
            const hasYT = allHandles.some(h => (h.includes("::") ? h.split("::")[1] : "youtube") === "youtube");
            const hasIG = allHandles.some(h => (h.includes("::") ? h.split("::")[1] : "youtube") === "instagram");
            const cols = [];
            if (hasTT) cols.push({ pt: "tiktok", name: "TikTok" });
            if (hasYT) cols.push({ pt: "youtube", name: "YouTube" });
            if (hasIG) cols.push({ pt: "instagram", name: "Instagram" });
            const boxStyle = { flex: "0 0 calc((100% - 16px) / 3)", minWidth: 0 };
            return (
              <div key={b.id} className={`bcard${!hasData?" dead":""}`} onClick={() => onBrand(b.id)}>
                <div className="bcard-top">
                  <div style={{display:"flex",alignItems:"center",gap:9}}>
                    <Pfp srcs={thumbs} size={32} name={b.name}/>
                    <span className="bcard-name">{b.name}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    {hasData && (
                      <div style={{display:"flex",alignItems:"baseline",gap:12}}>
                        <div style={{textAlign:"center"}}>
                          <div style={{fontFamily:"var(--display)",fontSize:17,color:"var(--text)",lineHeight:1.2}}><RollingNumber value={brandFollowers} spinning={!skipNumberAnim && !dataReady} magnitude={1e4} skipAnimation={skipNumberAnim} /></div>
                          <div style={{fontFamily:"var(--mono)",fontSize:7,color:"var(--text3)"}}>flw</div>
                        </div>
                        <div style={{textAlign:"center"}}>
                          <div style={{fontFamily:"var(--display)",fontSize:17,color:"var(--text)",lineHeight:1.2}}><RollingNumber value={brandViews} spinning={!skipNumberAnim && !dataReady} magnitude={1e6} skipAnimation={skipNumberAnim} /></div>
                          <div style={{fontFamily:"var(--mono)",fontSize:7,color:"var(--text3)"}}>views</div>
                        </div>
                      </div>
                    )}
                    <span className={`bstatus ${allInactive?"s-dead":hasData?"s-active":"s-dead"}`}>{allInactive?"inactive":hasData?"active":"sync needed"}</span>
                  </div>
                </div>
                {cols.length > 0 && (
                <div className="bcard-platforms" style={{display:"flex",justifyContent:"center",flexWrap:"wrap",gap:8,marginTop:8}}>
                  {cols.map(({ pt, name }) => {
                    const ptHandles = allHandles.filter(h => (h.includes("::") ? h.split("::")[1] : "youtube") === pt);
                    const ptChData = ptHandles.map(h => channelData[h]).filter(Boolean);
                    const followers = ptChData.reduce((s, c) => s + getFollowers(c), 0);
                    const views = ptChData.reduce((s, c) => s + (c.totalViews || 0), 0);
                    const ptBadges = ptHandles.map(key => ({ key, isActive: b.handleStatus?.[key] !== false }));
                    return (
                      <div key={pt} style={{...boxStyle,display:"flex",flexDirection:"column",alignItems:"center",padding:"8px 6px",background:"var(--surface2)",borderRadius:4,border:"1px solid var(--border)"}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4,marginBottom:6}}>
                          <span style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--text3)"}}>{name}</span>
                          <div style={{display:"flex",gap:3,flexShrink:0}}>
                            {ptBadges.map(({ key, isActive }) => (
                              <span key={key} style={{fontSize:7,padding:"1px 4px",borderRadius:2,background:isActive?"var(--green-dim)":"var(--red-dim)",color:isActive?"var(--green)":"var(--red)"}}>{isActive?"active":"inactive"}</span>
                            ))}
                          </div>
                        </div>
                        <div style={{display:"flex",width:"100%",alignItems:"baseline"}}>
                          <div style={{flex:1,textAlign:"center",paddingRight:8,borderRight:"1px solid var(--border2)"}}>
                            <div style={{fontFamily:"var(--display)",fontSize:17,color:"var(--text)",lineHeight:1.2}}>{ptChData.length ? <RollingNumber value={followers} spinning={!skipNumberAnim && !dataReady} magnitude={1e4} skipAnimation={skipNumberAnim} /> : "—"}</div>
                            <div style={{fontFamily:"var(--mono)",fontSize:7,color:"var(--text3)"}}>flw</div>
                          </div>
                          <div style={{flex:1,textAlign:"center",paddingLeft:8}}>
                            <div style={{fontFamily:"var(--display)",fontSize:17,color:"var(--text)",lineHeight:1.2}}>{ptChData.length ? <RollingNumber value={views} spinning={!skipNumberAnim && !dataReady} magnitude={1e6} skipAnimation={skipNumberAnim} /> : "—"}</div>
                            <div style={{fontFamily:"var(--mono)",fontSize:7,color:"var(--text3)"}}>views</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const PLAT_TAB_LABEL = { all: "ALL", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube" };
const getPlat = (c) => (c?.platform?.platformType || c?.channel?.platform || "youtube");

function BrandResyncButton({ dbBrand, platTab, fetchChannel, onAccounts }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const key = (dbBrand.handles || []).find(k => (pk(k).platform || "youtube") === platTab);
  if (!key) return <span>Go to <button type="button" className="ibtn" style={{margin:"0 4px"}} onClick={onAccounts}>Accounts</button> to re-sync.</span>;
  const { handle: rawHandle, platform: rawPlat } = pk(key);
  const doResync = async () => {
    setLoading(true); setErr(null);
    try {
      await fetchChannel(rawHandle, rawPlat, true, true);
    } catch (e) { setErr(e?.message || String(e)); }
    setLoading(false);
  };
  return (
    <>
      <button type="button" className="ibtn primary" disabled={loading} onClick={doResync}>{loading ? <span className="sync-loading"><Spinner/> Syncing…</span> : "⟳ Re-sync videos"}</button>
      {err && <div style={{marginTop:8,color:"var(--red)",fontSize:11}}>{err}</div>}
    </>
  );
}

const BRAND_TAB_KEY = "tambareni-brand-tab";
function BrandView({ brandId, onBack, brands, onAccounts }) {
  const { channelData, fetchChannel } = useYouTubeContext();
  const dbBrand = brands?.find(b => b.id === brandId);
  if (!dbBrand) return null;

  const allHandles = dbBrand.handles;
  const allChData = allHandles.map(key => channelData[key]).filter(Boolean);
  const hasChannelData = allChData.length > 0;
  const platOrder = ["tiktok", "instagram", "youtube"];
  const availablePlatforms = platOrder.filter(p => allChData.some(c => getPlat(c) === p));
  const brandPlatforms = platOrder.filter(p => allHandles.some(k => (pk(k).platform || "youtube") === p));
  const isPlatformInactive = (p) => {
    const ptHandles = allHandles.filter(k => (pk(k).platform || "youtube") === p);
    return ptHandles.length > 0 && ptHandles.every(k => dbBrand.handleStatus?.[k] === false);
  };
  const validTabs = ["all", "youtube", "tiktok", "instagram", ...brandPlatforms];
  const [platTab, setPlatTab] = useState(() => {
    try {
      const raw = localStorage.getItem(`${BRAND_TAB_KEY}-${brandId}`);
      if (raw && validTabs.includes(raw)) return raw;
    } catch {}
    return "all";
  });
  const actualTab = brandPlatforms.includes(platTab) || platTab === "all" ? platTab : "all";
  const setPlatTabPersist = useCallback((tab) => {
    setPlatTab(tab);
    try { localStorage.setItem(`${BRAND_TAB_KEY}-${brandId}`, tab); } catch {}
  }, [brandId]);
  const chData = actualTab === "all" ? allChData : allChData.filter(c => getPlat(c) === actualTab);

  const totalFollowers = chData.reduce((s, c) => s + getFollowers(c), 0);
  const totalViews = chData.reduce((s, c) => s + (c.totalViews || 0), 0);
  const postsRaw = chData.flatMap(c => (c.posts || []).map(p => ({ ...p, _plat: getPlat(c) })));
  const posts = (() => {
    const byId = new Map();
    postsRaw.forEach(p => {
      const existing = byId.get(p.id);
      if (!existing || (p.views || 0) > (existing.views || 0)) byId.set(p.id, p);
    });
    return Array.from(byId.values());
  })();
  posts.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  const avgV = posts.length ? Math.round(posts.reduce((s, p) => s + p.views, 0) / posts.length) : 0;
  const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0);
  const totalPostViews = posts.reduce((s, p) => s + (p.views || 0), 0);
  const avgLv = totalPostViews > 0 ? ((totalLikes / totalPostViews) * 100).toFixed(2) : "—";
  const totalComments = posts.reduce((s, p) => s + (p.cmts || 0), 0);
  const thumbs = getAllBrandThumbs(dbBrand, channelData);

  const dgStorageKey = `brand-dg-range-${brandId}`;
  const [dailyGrowthRange, setDailyGrowthRange] = useState("all");
  useEffect(() => {
    try {
      const v = localStorage.getItem(dgStorageKey);
      if (v && DAILY_GROWTH_RANGE_OPTIONS.some((o) => o.id === v)) setDailyGrowthRange(v);
      else setDailyGrowthRange("all");
    } catch {
      setDailyGrowthRange("all");
    }
  }, [dgStorageKey]);
  const persistDailyGrowthRange = useCallback(
    (id) => {
      setDailyGrowthRange(id);
      try {
        localStorage.setItem(dgStorageKey, id);
      } catch {}
    },
    [dgStorageKey]
  );
  const viewsDataFull = useMemo(() => buildDailyGrowthSeriesFromChannels(chData), [chData]);
  const viewsData = useMemo(() => {
    const filtered = filterDailyGrowthByRange(viewsDataFull, dailyGrowthRange);
    return annotateActivityDates(filtered);
  }, [viewsDataFull, dailyGrowthRange]);
  const reliableSnapshotLineX = reliableSnapshotAxisX(viewsData);
  const dailyGrowthXTicks = useMemo(() => dailyGrowthXAxisTicks(viewsData), [viewsData]);
  const dailyGrowthYMax = useMemo(() => dailyGrowthYAxisDomainMax(viewsData), [viewsData]);
  const dgLabelFontSize = viewsData.length > 40 ? 6 : viewsData.length > 22 ? 7 : 8;
  const weekdayGrowthData = useMemo(() => buildWeekdayGrowthChartData(viewsData), [viewsData]);

  const tabs = [{ k: "all", label: "ALL" }, ...brandPlatforms.map(p => ({ k: p, label: PLAT_TAB_LABEL[p] || p, inactive: isPlatformInactive(p) }))];

  return (
    <div>
      <div className="topbar">
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button className="ibtn" onClick={onBack}>← BACK</button>
          <Pfp srcs={thumbs} size={24} name={dbBrand.name}/>
          <span className="topbar-title">{dbBrand.name}</span>
          {hasChannelData && <span className="bstatus s-active">active</span>}
        </div>
        <button className="ibtn" onClick={onAccounts}>Accounts</button>
      </div>
      <div className="page">
        {!hasChannelData && (
          <div className="alert" style={{marginBottom:18}}>
            <span className="alert-txt"><strong>No synced data.</strong> Go to <strong>Accounts</strong> → re-sync channels for this brand.</span>
          </div>
        )}
        {hasChannelData && (
          <div className="tpill" style={{marginBottom:16}}>
            {tabs.map(({ k, label, inactive }) => (
              <button key={k} type="button" className={`tbtn ${actualTab === k ? "act" : ""} ${inactive ? "strike" : ""}`} style={inactive ? {textDecoration:"line-through",opacity:0.7} : undefined} onClick={() => setPlatTabPersist(k)}>{label}</button>
            ))}
          </div>
        )}

        {hasChannelData && (
          <>
            <div className="krow" style={{gridTemplateColumns:"repeat(5,1fr)"}}>
              {[
                {l:"Followers",v:fmt(totalFollowers)},{l:"Total Views",v:fmt(totalViews)},
                {l:"Avg Views/Post",v:fmt(avgV)},{l:"Total Likes",v:fmt(totalLikes)},{l:"Comments",v:fmt(totalComments)},
              ].map(k => (
                <div key={k.l} className="kcard"><div className="klbl">{k.l}</div><div className="kval">{k.v}</div></div>
              ))}
            </div>

            <div className="panel" style={{marginBottom:14}}>
              <div className="ph" style={{ flexWrap: "wrap", alignItems: "center", gap: 8, rowGap: 6 }}>
                <span className="ptitle">DAILY GROWTH</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                  {DAILY_GROWTH_RANGE_OPTIONS.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className={`tbtn ${dailyGrowthRange === o.id ? "act" : ""}`}
                      style={{ fontSize: 10, padding: "3px 8px" }}
                      onClick={() => persistDailyGrowthRange(o.id)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              {viewsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={182}>
                  <AreaChart data={viewsData} margin={{ top: 10, right: 32, bottom: 12, left: 2 }}>
                    <defs>
                      <linearGradient id="gv-brand" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff6b6b" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#ff6b6b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="activityRaw"
                      ticks={dailyGrowthXTicks}
                      tick={{ fontFamily: "DM Mono", fontSize: 8, fill: "#444" }}
                      tickFormatter={(v) => formatDailyGrowthXTick(v, viewsData)}
                      axisLine={false}
                      tickLine={false}
                      height={26}
                    />
                    <YAxis
                      domain={dailyGrowthYMax != null ? [0, dailyGrowthYMax] : [0, "auto"]}
                      tick={{ fontFamily: "DM Mono", fontSize: 8, fill: "#444" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={fmtWhole}
                      width={40}
                    />
                    <Tooltip content={<TTip/>} cursor={{stroke:"#444",strokeWidth:1}}/>
                    <Area type="monotone" dataKey="views" stroke="#ff6b6b" strokeWidth={2} fill="url(#gv-brand)" name="Views" dot={{r:3,fill:"#ff6b6b",strokeWidth:0}} activeDot={{r:4,stroke:"#fff",strokeWidth:2}} isAnimationActive={false}>
                      <LabelList
                        dataKey="views"
                        position="top"
                        offset={4}
                        formatter={(v) => fmtWhole(v)}
                        style={{ fontFamily: "DM Mono", fontSize: dgLabelFontSize, fill: "#888" }}
                      />
                    </Area>
                    {reliableSnapshotLineX && (
                      <ReferenceLine
                        x={reliableSnapshotLineX}
                        stroke="rgba(245,242,237,0.45)"
                        strokeWidth={1}
                        strokeDasharray="4 4"
                        isFront
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{height:182,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text3)",fontSize:11}}>Need 2+ days of data.</div>
              )}
            </div>

            <WeekdayGrowthPanel
              data={weekdayGrowthData}
              height={168}
              emptyHint="No data yet."
              panelStyle={{ marginBottom: 14 }}
            />

            {actualTab !== "all" && posts.length > 0 && (
              <div className="panel">
                <div className="ph">
                  <span className="ptitle">POST FEED — {dbBrand.name.toUpperCase()} · {PLAT_TAB_LABEL[actualTab] || actualTab}</span>
                  <span className="pact">AVG {fmtNum(avgV)} VIEWS/POST · AVG L/V {avgLv}% · {posts.length} POSTS</span>
                </div>
                <div className="avgline">
                  <span style={{color:"var(--red)",fontFamily:"DM Mono",fontSize:9,whiteSpace:"nowrap"}}>AVG {fmtNum(avgV)}</span>
                  <div className="albar"/>
                  <span style={{color:"#333",fontSize:8}}>THRESHOLD</span>
                </div>
                <div className="pgrid">
                  {posts.map(p => (
                    <div key={p.id} className={`pcard${(p.views||0)<avgV?" ba":""}`}>
                      <div className="pthumb">
                        {p.thumbnail ? (
                          <img src={p.thumbnail} alt="" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center 10%"}}/>
                        ) : (
                          <span>{p.emoji || "▶️"}</span>
                        )}
                        {(p.views||0)<avgV && <span className="bab">BELOW AVG</span>}
                      </div>
                      <div className="pbody">
                        <div className="pcap">{p.cap}</div>
                        <div style={{fontSize:9,color:"var(--text3)",marginBottom:4}}>
                          {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}
                        </div>
                        <div className="pvbig">{fmtNum(p.views ?? 0)} views</div>
                        <div className="psr">
                          <div className="psr-left">
                            <div className="pst">❤️ <span>{fmtNum(p.likes ?? 0)}</span></div>
                            <div className="pst">💬 <span>{fmtNum(p.cmts ?? 0)}</span></div>
                            {p.shares > 0 && <div className="pst">↗️ <span>{fmtNum(p.shares ?? 0)}</span></div>}
                          </div>
                          {(p.views||0)>0 && (
                            <div className="pst-lv">
                              L/V: {((p.likes||0)/(p.views||1)*100).toFixed(2)}%
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {actualTab !== "all" && posts.length === 0 && (
              <div className="panel">
                <div style={{textAlign:"center",padding:"30px",color:"var(--text3)",fontSize:12}}>
                  No posts for {PLAT_TAB_LABEL[actualTab]} yet.
                  <div style={{marginTop:8,fontSize:11}}>Likes and comments come from individual videos — they&apos;ll appear here once videos load.</div>
                  {chData.length > 0 && (totalViews > 0 || totalFollowers > 0) && (
                    <div style={{marginTop:12}}>
                      <BrandResyncButton dbBrand={dbBrand} platTab={actualTab} fetchChannel={fetchChannel} onAccounts={onAccounts}/>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Settings({ brands, brandsLoading, channelMeta, addBrand, removeBrand, addHandleToBrand, removeHandleFromBrand, removeChannel, toggleActive, onBack }) {
  const [modal, setModal] = useState(null);
  const [syncHandle, setSyncHandle] = useState("");
  const [syncPlatform, setSyncPlatform] = useState("youtube");
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [syncBrandId, setSyncBrandId] = useState(null);
  const [newBrandName, setNewBrandName] = useState("");
  const [resyncKey, setResyncKey] = useState(null);
  const syncCancelledRef = useRef(false);
  const { apiKey, fetchChannel, channelData } = useYouTubeContext();

  const cancelAddAccount = () => {
    syncCancelledRef.current = true;
    setSyncLoading(false);
    setModal(null);
    setSyncHandle("");
    setSyncBrandId(null);
    setSyncError(null);
  };

  const handleSync = async (targetBrandId) => {
    if (!syncHandle.trim()) { setSyncError("Please enter a handle"); return; }
    if (!targetBrandId) { setSyncError("Please select a brand"); return; }
    if (syncPlatform !== "instagram" && !apiKey) { setSyncError("API key required for YouTube and TikTok."); return; }
    if (syncPlatform === "instagram" && !getInstagramToken(syncHandle.trim()) && !apiKey) { setSyncError("For new Instagram accounts, API key required. Configure Supabase or set VITE_SCRAPECREATORS_API_KEY."); return; }
    syncCancelledRef.current = false;
    setSyncLoading(true); setSyncError(null);
    try {
      const entry = await fetchChannel(syncHandle.trim(), syncPlatform, true);
      if (syncCancelledRef.current) return;
      const rawHandle = entry?.channel?.handle || entry?.platform?.handle || entry?.channel?.title;
      const ytChannelId = entry?.channel?.id || null;
      if (rawHandle) {
        await addHandleToBrand(targetBrandId, rawHandle, syncPlatform, ytChannelId);
        if (syncCancelledRef.current) return;
        setSyncHandle("");
        setSyncBrandId(null);
        setSyncError(null);
        setModal(null);
      }
    } catch (e) { if (!syncCancelledRef.current) setSyncError(e.message); }
    finally { setSyncLoading(false); }
  };


  return (
    <div>
      <div className="topbar">
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button className="ibtn" onClick={onBack}>← BACK</button>
          <span className="topbar-title">ACCOUNT MANAGER</span>
        </div>
        <div className="tr" style={{gap:8}}>
          <button className="ibtn primary" onClick={() => setModal("brand")}>+ ADD BRAND</button>
          <button className="ibtn primary" onClick={() => setModal("account")}>+ ADD ACCOUNT</button>
        </div>
      </div>
      <div className="page">
        <div style={{marginBottom:24}}>
          <div className="stitle">CONNECTED ACCOUNTS</div>
          <div className="sdesc">Add brands first, then add YouTube, TikTok, or Instagram accounts via + ADD ACCOUNT.</div>
          {syncError && (
            <div className="alert" style={{marginBottom:12}}>
              <span className="alert-txt">{syncError}</span>
              <button className="ibtn" onClick={() => setSyncError(null)}>✕</button>
            </div>
          )}
          {brandsLoading ? (
            <div style={{padding:20,textAlign:"center",color:"var(--text3)",fontSize:12,border:"1px dashed var(--border2)",borderRadius:4}}>Loading brands…</div>
          ) : brands.length === 0 ? (
            <div style={{padding:20,textAlign:"center",color:"var(--text3)",fontSize:12,border:"1px dashed var(--border2)",borderRadius:4}}>Add a brand first, then add accounts via + ADD ACCOUNT.</div>
          ) : brands.map(b => (
            <div key={b.id} style={{marginBottom:16,border:"1px solid var(--border)",borderRadius:5,overflow:"hidden",background:"var(--surface)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"var(--surface2)",borderBottom:"1px solid var(--border)"}}>
                <span style={{fontFamily:"var(--display)",fontSize:14,letterSpacing:1,color:"var(--text)"}}>{b.name}</span>
                <button className="ibtn danger" style={{padding:"3px 8px",fontSize:9}} onClick={async () => await removeBrand(b.id)}>✕ Remove</button>
              </div>
              <div style={{padding:12}}>
                {[...b.handles].sort((a, b) => {
                  const platOrder = { tiktok: 0, instagram: 1, youtube: 2 };
                  const pa = pk(a).platform || "youtube";
                  const pb = pk(b).platform || "youtube";
                  return (platOrder[pa] ?? 99) - (platOrder[pb] ?? 99);
                }).map(key => {
                  const d = channelData[key];
                  const { handle: rawHandle, platform: rawPlat } = pk(key);
                  const pt = d?.platform?.platformType || rawPlat;
                  const apiHandle = d?.channel?.handle || d?.platform?.handle || rawHandle;
                  const showName = d?.platform?.displayName || d?.channel?.title || rawHandle;
                  const isActive = b.handleStatus?.[key] !== false;
                  return (
                    <div key={key} className="arow" style={!isActive ? {opacity:.45} : undefined}>
                      <Pfp srcs={getChannelThumbs(d)} size={28} name={showName}/>
                      <div className="ainfo">
                        <div className="ahandle">{showName}</div>
                        <div className="atag">{!isActive ? `${pt} · deactivated` : d ? pt : "not synced"}</div>
                      </div>
                      <div className="ameta">
                        <span>{d ? fmt(getFollowers(d)) + " followers" : "—"}</span><br/>
                        <span className={`chip ${isActive ? (d ? "cg" : "ctt") : "cr"}`}>{isActive ? (d ? "ACTIVE" : "SYNC NEEDED") : "INACTIVE"}</span>
                      </div>
                      <div className="aacts">
                        <button className="ibtn" title={isActive ? "Deactivate" : "Activate"} onClick={async () => { setSyncError(null); try { await toggleActive(b.id, key, !isActive); } catch (e) { setSyncError(e?.message || String(e)); } }} style={!isActive ? {color:"var(--green)",borderColor:"rgba(0,184,148,.3)"} : {}}>{isActive ? "⏸" : "▶"}</button>
                        {isActive && (
                          <button className="ibtn" title="Re-sync" disabled={resyncKey === key}
                            onClick={async () => {
                              setResyncKey(key); setSyncError(null);
                              try {
                                const meta = channelMeta?.[key];
                                await fetchChannel(rawHandle, rawPlat, true, true, { youtubeChannelId: meta?.youtubeChannelId });
                              } catch (e) {
                                setSyncError(e.message || String(e));
                              } finally {
                                setResyncKey(null);
                              }
                            }}>
                            {resyncKey === key ? <Spinner size={10} /> : "⟳"}
                          </button>
                        )}
                        <button className="ibtn danger" onClick={async () => { removeChannel(key); await removeHandleFromBrand(b.id, rawHandle, rawPlat); }}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {modal === "brand" && (
        <div className="ovrl" onClick={() => { setModal(null); setNewBrandName(""); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mtitle">ADD BRAND</div>
            <div className="msub">Create a new brand to group accounts under.</div>
            <div className="fg"><label className="flbl">Brand Name</label><input className="finput" placeholder="e.g. Raw Truth Podcast" value={newBrandName} onChange={e => setNewBrandName(e.target.value)}/></div>
            <div className="fg"><label className="flbl">Brand Color</label>
              <input className="finput" type="color" defaultValue="#d63031" style={{height:40,padding:3,cursor:"pointer"}}/></div>
            <div className="macts">
              <button className="ibtn" onClick={() => { setModal(null); setNewBrandName(""); }}>Cancel</button>
              <button className="ibtn primary" onClick={() => { addBrand(newBrandName || "New Brand"); setModal(null); setNewBrandName(""); }}>CREATE BRAND</button>
            </div>
          </div>
        </div>
      )}

      {modal === "account" && (
        <div className="ovrl" onClick={syncLoading ? cancelAddAccount : () => { setModal(null); setSyncHandle(""); setSyncBrandId(null); setSyncError(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mtitle">ADD ACCOUNT</div>
            <div className="msub">Add a YouTube, TikTok, or Instagram account. Select a brand to assign it to.</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"center",marginBottom:12}}>
              <span className={`chip ${apiKey?"cig":"ctt"}`}>{apiKey ? "API KEY OK" : "NO API KEY"}</span>
            </div>
            <div className="fg">
              <label className="flbl">Platform</label>
              <select className="fselect" value={syncPlatform} onChange={e => { setSyncPlatform(e.target.value); setSyncError(null); }} style={{width:"100%"}}>
                <option value="youtube">YouTube</option>
                <option value="tiktok">TikTok</option>
                <option value="instagram">Instagram</option>
              </select>
            </div>
            <div className="fg">
              <label className="flbl">Handle</label>
              <input className="finput" placeholder={syncPlatform === "tiktok" ? "e.g. charlidamelio" : syncPlatform === "instagram" ? "e.g. rawtruthpodcast" : "e.g. @RawTruth.Podcast"} value={syncHandle} onChange={e => { setSyncHandle(e.target.value); setSyncError(null); }} style={{width:"100%"}}/>
            </div>
            <div className="fg">
              <label className="flbl">Brand</label>
              <select className="fselect" value={syncBrandId || ""} onChange={e => { setSyncBrandId(e.target.value || null); setSyncError(null); }} style={{width:"100%"}}>
                <option value="">Select brand…</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            {syncError && <div style={{marginBottom:12,fontSize:11,color:"var(--red)"}}>{syncError}</div>}
            <div className="macts">
              <button className="ibtn" onClick={syncLoading ? cancelAddAccount : () => { setModal(null); setSyncHandle(""); setSyncBrandId(null); setSyncError(null); }}>Cancel</button>
              <button className="ibtn primary" disabled={(syncPlatform !== "instagram" ? !apiKey : !apiKey && !getInstagramToken(syncHandle.trim())) || syncLoading} onClick={() => handleSync(syncBrandId)}>{syncLoading ? <span className="sync-loading"><Spinner/> Syncing…</span> : "ADD ACCOUNT"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const STORAGE_KEY = "tambareni-nav";
const BRANDS_KEY = "tambareni-brands";
function loadNav() { try { const v = localStorage.getItem(STORAGE_KEY); if (v) { const j = JSON.parse(v); return { page: j.page || "overview", brandId: j.brandId || null }; } } catch {} return { page: "overview", brandId: null }; }
function saveNav(page, brandId) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ page, brandId })); } catch {} }
function loadBrandsLocal() { try { const v = localStorage.getItem(BRANDS_KEY); if (v) return JSON.parse(v); } catch {} return []; }

export default function App() {
  const [nav, setNav] = useState(loadNav);
  const [brands, setBrands] = useState(loadBrandsLocal);
  const [brandsLoading, setBrandsLoading] = useState(isSupabaseConfigured());
  const [channelMeta, setChannelMeta] = useState({});
  const { connectedHandles, channelData, removeChannel, fetchChannel, fetchChannelBatch } = useYouTubeContext();

  const page = nav.page;
  const brandId = nav.brandId;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const go = (p, id = null) => {
    const next = { page: p, brandId: id ?? (p === "brand" ? brandId : null) };
    setNav(next);
    saveNav(next.page, next.brandId);
    setSidebarOpen(false);
  };
  const pageTitle = page === "overview" ? "Social Media" : page === "matchmax" ? "MatchMax App" : page === "settings" ? "Accounts" : brands.find(b => b.id === brandId)?.name || "Brand";

  const getBrandNameForChannel = (ch) => {
    const name = ch?.platform?.displayName || ch?.channel?.title || ch?.platform?.handle;
    return name;
  };

  useEffect(() => {
    const loadAndRefetch = async (brandsData, meta = {}) => {
      setBrands(brandsData);
      setChannelMeta(meta);
      const keys = [...new Set(brandsData.flatMap(b => b.handles || []))];
      const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;
      const concurrency = isMobile ? 6 : 12;
      await runWithConcurrency(keys, concurrency, (key) => {
        const { handle, platform } = pk(key);
        const anyActive = brandsData.some(
          (b) => (b.handles || []).includes(key) && b.handleStatus?.[key] !== false
        );
        return fetchChannel(handle, platform, false, false, { skipDailySnapshot: !anyActive }).catch(() => null);
      });
    };
    if (isSupabaseConfigured()) {
      fetchBrandsWithChannels()
        .then(res => loadAndRefetch(res.brands ?? [], res.channelMeta ?? {}))
        .catch(err => { console.error("Supabase brands load failed:", err); return loadAndRefetch(loadBrandsLocal()); })
        .finally(() => setBrandsLoading(false));
    } else {
      loadAndRefetch(loadBrandsLocal()).finally(() => setBrandsLoading(false));
    }
  }, [fetchChannel]);

  const addHandleToBrand = useCallback(async (brandId, handle, platform = "youtube", youtubeChannelId = null) => {
    if (isSupabaseConfigured()) await dbAddChannelToBrand(brandId, handle, platform, youtubeChannelId);
    const key = ck(handle, platform);
    setBrands(prev => { const next = prev.map(b => b.id === brandId ? { ...b, handles: [...new Set([...b.handles, key])], handleStatus: { ...b.handleStatus, [key]: true } } : b); if (!isSupabaseConfigured()) try { localStorage.setItem(BRANDS_KEY, JSON.stringify(next)); } catch {} return next; });
  }, []);

  // When Supabase is configured, DB is source of truth for which brands have which channels.
  const addBrand = useCallback(async (name) => {
    const b = { id: crypto.randomUUID(), name: name || "New Brand", color: "#d63031", handles: [] };
    if (isSupabaseConfigured()) { const row = await dbCreateBrand({ name: b.name, color: b.color }); b.id = row.id; }
    setBrands(prev => { const next = [...prev, b]; if (!isSupabaseConfigured()) try { localStorage.setItem(BRANDS_KEY, JSON.stringify(next)); } catch {} return next; });
    return b;
  }, []);

  const removeBrand = useCallback(async (id, removeChannelFn) => {
    const b = brands.find(x => x.id === id);
    if (b?.handles) b.handles.forEach(key => removeChannelFn?.(key));
    if (isSupabaseConfigured()) await dbDeleteBrand(id);
    setBrands(prev => { const next = prev.filter(x => x.id !== id); if (!isSupabaseConfigured()) try { localStorage.setItem(BRANDS_KEY, JSON.stringify(next)); } catch {} return next; });
  }, [brands]);

  const removeHandleFromBrand = useCallback(async (brandId, handle, platform) => {
    if (isSupabaseConfigured()) await dbRemoveChannelFromBrand(brandId, handle, platform);
    const key = ck(handle, platform);
    setBrands(prev => { const next = prev.map(b => b.id === brandId ? { ...b, handles: b.handles.filter(h => h !== key) } : b); if (!isSupabaseConfigured()) try { localStorage.setItem(BRANDS_KEY, JSON.stringify(next)); } catch {} return next; });
  }, []);

  const toggleActive = useCallback(async (brandId, key, active) => {
    const { handle, platform } = pk(key);
    if (isSupabaseConfigured()) await dbToggleChannelActive(brandId, handle, platform, active);
    // Keep last-known stats in memory when deactivating; do not clear channelData.
    if (active) fetchChannel(handle, platform, true, false, { skipDailySnapshot: false }).catch(() => {});
    setBrands(prev => {
      const n = prev.map(b => b.id === brandId ? { ...b, handleStatus: { ...b.handleStatus, [key]: active } } : b);
      if (!isSupabaseConfigured()) try { localStorage.setItem(BRANDS_KEY, JSON.stringify(n)); } catch {}
      return n;
    });
  }, [fetchChannel]);

  const LAST_REFRESH_KEY = "tambareni-last-refresh";
  const SYNC_IN_PROGRESS_KEY = "tambareni-sync-in-progress";
  const SYNC_IN_PROGRESS_TTL = 5 * 60 * 1000; // 5 min
  const [syncing, setSyncing] = useState(() => {
    try {
      const raw = localStorage.getItem(SYNC_IN_PROGRESS_KEY);
      if (!raw) return false;
      const { startedAt } = JSON.parse(raw);
      return Date.now() - startedAt < SYNC_IN_PROGRESS_TTL;
    } catch { return false; }
  });
  const [lastSync, setLastSync] = useState(() => {
    try {
      const s = localStorage.getItem(LAST_REFRESH_KEY);
      if (s) return new Date(s);
      return null;
    } catch { return null; }
  });
  const [syncErrors, setSyncErrors] = useState([]);
  const [syncProgress, setSyncProgress] = useState({ completed: 0, total: 0 });
  const [syncElapsed, setSyncElapsed] = useState(0);
  const syncStartRef = useRef(0);

  const refreshLastSync = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    const dbTime = await fetchLastSyncTime().catch(() => null);
    if (dbTime) setLastSync(prev => (!prev || dbTime > prev ? dbTime : prev));
  }, []);

  useEffect(() => {
    refreshLastSync();
    const id = setInterval(refreshLastSync, 120000);
    const onVisible = () => { if (document.visibilityState === "visible") refreshLastSync(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshLastSync]);

  const SYNC_PASSWORD = import.meta.env.VITE_SYNC_PASSWORD || "hi";
  const [syncPwModal, setSyncPwModal] = useState(false);
  const [syncPwInput, setSyncPwInput] = useState("");
  const [syncPwError, setSyncPwError] = useState("");
  const doSyncAll = useCallback(async (forceResume = false) => {
    if (!forceResume && syncing) return;
    setSyncing(true);
    setSyncErrors([]);
    setSyncElapsed(0);
    syncStartRef.current = Date.now();
    try {
      try { localStorage.setItem(SYNC_IN_PROGRESS_KEY, JSON.stringify({ startedAt: Date.now() })); } catch {}
      const keys = [...new Set(brands.flatMap(b => b.handles.filter(key => b.handleStatus?.[key] !== false)))];
      const total = keys.length;
      setSyncProgress({ completed: 0, total });
      const errs = [];
      const allScKeys = keys.filter((k) => {
        const p = (pk(k).platform || "youtube").toLowerCase();
        return p === "youtube" || p === "tiktok" || p === "instagram";
      });
      const legacyIgKeys = allScKeys.filter((k) => {
        if ((pk(k).platform || "").toLowerCase() !== "instagram") return false;
        const { handle } = pk(k);
        return channelMeta?.[k]?.hasLegacyInstagramToken || !!getInstagramToken(handle);
      });
      const batchKeys = allScKeys.filter((k) => !legacyIgKeys.includes(k));

      if (batchKeys.length > 0 && isSupabaseConfigured()) {
        try {
          const items = batchKeys.map((key) => {
            const { handle, platform } = pk(key);
            const meta = channelMeta?.[key];
            return {
              handle,
              platform,
              youtubeChannelId: meta?.youtubeChannelId || null,
            };
          });
          const results = await fetchChannelBatch(items);
          setSyncProgress({ completed: batchKeys.length, total });
          for (const r of results) {
            if (!r.ok) errs.push({ key: r.key, msg: r.error || "Unknown error" });
          }
        } catch (batchErr) {
          for (let i = 0; i < batchKeys.length; i++) {
            const key = batchKeys[i];
            const { handle, platform } = pk(key);
            try {
              await fetchChannel(handle, platform, true, true);
            } catch (e) {
              errs.push({ key, msg: e?.message || String(e) });
            }
            setSyncProgress({ completed: i + 1, total });
          }
        }
      } else if (batchKeys.length > 0) {
        for (let i = 0; i < batchKeys.length; i++) {
          const key = batchKeys[i];
          const { handle, platform } = pk(key);
          try {
            await fetchChannel(handle, platform, true, true);
          } catch (e) {
            errs.push({ key, msg: e?.message || String(e) });
          }
            setSyncProgress({ completed: i + 1, total });
        }
      }

      for (let i = 0; i < legacyIgKeys.length; i++) {
        const key = legacyIgKeys[i];
        const { handle, platform } = pk(key);
        try {
          await fetchChannel(handle, platform, true, true);
        } catch (e) {
          errs.push({ key, msg: e?.message || String(e) });
        }
        setSyncProgress({ completed: batchKeys.length + i + 1, total });
      }

      setSyncProgress({ completed: total, total });
      setSyncErrors(errs);
      const now = new Date();
      setLastSync(now);
      try { localStorage.setItem(LAST_REFRESH_KEY, now.toISOString()); } catch {}
      if (isSupabaseConfigured()) {
        await upsertLastManualSync();
        refreshLastSync();
      }
    } finally {
      setSyncing(false);
      setSyncProgress({ completed: 0, total: 0 });
      setSyncElapsed(0);
      try { localStorage.removeItem(SYNC_IN_PROGRESS_KEY); } catch {}
    }
  }, [brands, channelMeta, fetchChannel, fetchChannelBatch, syncing, refreshLastSync]);

  useEffect(() => {
    if (!syncing) return;
    const id = setInterval(() => {
      setSyncElapsed(Math.floor((Date.now() - syncStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [syncing]);

  const hasAttemptedResume = useRef(false);
  useEffect(() => {
    if (brandsLoading || hasAttemptedResume.current) return;
    const raw = localStorage.getItem(SYNC_IN_PROGRESS_KEY);
    if (!raw) return;
    hasAttemptedResume.current = true;
    try {
      const { startedAt } = JSON.parse(raw);
      if (Date.now() - startedAt < SYNC_IN_PROGRESS_TTL) doSyncAll(true);
      else localStorage.removeItem(SYNC_IN_PROGRESS_KEY);
    } catch { localStorage.removeItem(SYNC_IN_PROGRESS_KEY); }
  }, [brandsLoading, doSyncAll]);

  const syncAll = useCallback(() => {
    setSyncPwModal(true);
    setSyncPwInput("");
    setSyncPwError("");
  }, []);
  const confirmSyncPw = useCallback(() => {
    if (syncPwInput === SYNC_PASSWORD) {
      setSyncPwModal(false);
      setSyncPwInput("");
      setSyncPwError("");
      doSyncAll();
    } else {
      setSyncPwError("Wrong password");
    }
  }, [syncPwInput, SYNC_PASSWORD, doSyncAll]);

  const SYNC_KEY = "tambareni-last-auto-sync";
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const last = localStorage.getItem(SYNC_KEY);
      const lastDate = last ? new Date(last).toDateString() : null;
      if (lastDate === now.toDateString()) return;
      const h = now.getHours(), m = now.getMinutes();
      const inWindow = (h === 23 && m >= 58) || (h === 0 && m <= 2);
      if (inWindow) {
        localStorage.setItem(SYNC_KEY, now.toISOString());
        doSyncAll();
      }
    };
    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, [doSyncAll]);

  return (
    <>
      <style>{FONTS}{css}</style>
      <div className="app">
        <div className={`sidebar ${sidebarOpen ? "mobile-open" : ""}`}>
          <div className="logo-area">
            <img src="/tm-logo-icon.jpg" alt="Tambareni Media" style={{width:62,height:62,borderRadius:6,objectFit:"cover",marginBottom:10}}/>
            <div className="logo-text">TAMBARENI<br/>MEDIA<br/>ANALYTICS</div>
          </div>
          <div className="nav-sec">
            <div className={`nav-item${page==="overview"?" act":""}`} onClick={() => go("overview")}>
              <div className="nav-dot" style={{background:"#d63031"}}/>Social Media
            </div>
            <div className={`nav-item${page==="matchmax"?" act":""}`} onClick={() => go("matchmax")}>
              <div className="nav-dot" style={{background:"#d63031"}}/>MatchMax App
            </div>
          </div>
          <div className="nav-sec">
            <div className="nav-lbl">Brands</div>
            {[...brands]
              .sort((a, b) => {
                const aAllInactive = a.handles?.length > 0 && a.handles.every(h => a.handleStatus?.[h] === false);
                const bAllInactive = b.handles?.length > 0 && b.handles.every(h => b.handleStatus?.[h] === false);
                if (aAllInactive === bAllInactive) return 0;
                return aAllInactive ? 1 : -1;
              })
              .map(b => {
                const thumbs = getAllBrandThumbs(b, channelData);
                const activeCount = b.handles?.filter(h => b.handleStatus?.[h] !== false).length ?? 0;
                const allInactive = (b.handles?.length ?? 0) > 0 && b.handles.every(h => b.handleStatus?.[h] === false);
                return (
                  <div key={b.id} className={`brand-item${page==="brand"&&brandId===b.id?" act":""}${allInactive?" strike":""}`} onClick={() => go("brand", b.id)} style={allInactive ? {opacity:0.65} : undefined}>
                    <Pfp srcs={thumbs} size={22} name={b.name}/>
                    <span style={{flex:1,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",...(allInactive?{textDecoration:"line-through"}:{})}} title={b.name}>{b.name}</span>
                    {activeCount > 0 && <span className="dbadge">{activeCount}</span>}
                  </div>
                );
              })}
          </div>
          <div style={{marginTop:"auto",padding:"14px 18px",borderTop:"1px solid var(--border)"}}>
            <div style={{fontFamily:"DM Mono",fontSize:8,color:"#333",letterSpacing:2}}>
              <>LAST REFRESH<br/><span style={{color:"#555",fontSize:9}}>{lastSync ? lastSync.toLocaleString() : "Never"}</span><br/><span style={{color:"#333",fontSize:8}}>Daily sync: 11 PM ET</span></>
            </div>
          </div>
        </div>
        <div className={`sidebar-overlay ${sidebarOpen ? "visible" : ""}`} onClick={() => setSidebarOpen(false)} aria-hidden="true" />
        <div className="main" onMouseDown={e => { const el = document.activeElement, t = e.target; if ((el?.tagName === "INPUT" || el?.tagName === "TEXTAREA") && !t.closest("input,textarea,select,button")) el.blur(); }}>
          <div className="mobile-topbar">
            <button type="button" className="mobile-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">☰</button>
            <div className="mobile-topbar-brand">
              <img src="/tm-logo-icon.jpg" alt="" className="mobile-topbar-logo"/>
              <span className="mobile-topbar-text">TAMBARENI MEDIA ANALYTICS</span>
            </div>
            <span className="mobile-topbar-title">{pageTitle}</span>
          </div>
          {page === "overview" && <Overview onBrand={id => go("brand", id)} brandsFromDb={brands} brandsLoading={brandsLoading} syncAll={syncAll} syncing={syncing} syncProgress={syncProgress} syncElapsed={syncElapsed} lastSync={lastSync} syncErrors={syncErrors} onAccounts={() => go("settings")}/>}
          {page === "matchmax" && (
            <div style={{minHeight:"100vh",display:"flex",flexDirection:"column"}}>
              <div className="topbar">
                <span className="topbar-title">MATCHMAX APP ANALYTICS</span>
                <button className="ibtn" onClick={() => go("settings")}>Accounts</button>
              </div>
              <div className="page" style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text3)",fontSize:16}}>Coming soon...</div>
            </div>
          )}
          {page === "brand" && <BrandView brandId={brandId} onBack={() => go("overview")} brands={brands} onAccounts={() => go("settings")}/>}
          {page === "settings" && <Settings brands={brands} brandsLoading={brandsLoading} channelMeta={channelMeta} addBrand={addBrand} removeBrand={id => removeBrand(id, removeChannel)} addHandleToBrand={addHandleToBrand} removeHandleFromBrand={removeHandleFromBrand} removeChannel={removeChannel} toggleActive={toggleActive} onBack={() => go("overview")}/>}
        </div>
      </div>

      {syncPwModal && (
        <div className="ovrl" onClick={() => !syncing && (setSyncPwModal(false), setSyncPwError(""))}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mtitle" style={{color:"#fff"}}>Sync All</div>
            <div className="msub">Enter password to sync all accounts</div>
            <div className="fg">
              <label className="flbl">Password</label>
              <input type="password" className="finput" value={syncPwInput} onChange={e => setSyncPwInput(e.target.value)} onKeyDown={e => e.key === "Enter" && confirmSyncPw()} placeholder="Password" autoFocus/>
            </div>
            {syncPwError && <div style={{color:"var(--red)",fontSize:11,marginBottom:8}}>{syncPwError}</div>}
            <div className="macts">
              <button className="ibtn" onClick={() => setSyncPwModal(false)}>Cancel</button>
              <button className="ibtn primary" onClick={confirmSyncPw} disabled={!syncPwInput || syncing}>{syncing ? <span className="sync-loading"><Spinner/> Syncing…</span> : "Sync"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
