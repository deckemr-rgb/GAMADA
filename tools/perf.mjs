// Perf harness: drives the real page with wheel input (so Lenis + ScrollTrigger run exactly as for a user)
// and reads frame-time stats from the ?debug=fps HUD (window.__fps).
//
// usage: node tools/perf.mjs [url] [cpuThrottle=4] [width=1440] [height=900] [dpr=1.25] [label]
//   url default: http://127.0.0.1:4173/   (run `npm run build && npm run preview` first)
// Scenarios: idle on hero (4s) · scroll hero→tranquility · scroll tranquility→biodiversity ·
// scroll through the content sections · scroll back to the hero.
// Prints a JSON line per scenario and a markdown table.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [url = "http://127.0.0.1:4173/", cpu = "4", w = "1440", h = "900", dpr = "1.25", label = ""] = process.argv.slice(2);
const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const port = 9800 + Math.floor(Math.random() * 150);
const prof = mkdtempSync(join(tmpdir(), "cdp-"));
// GPU enabled (hardware raster/compositing like a real browser), unlike shot.mjs.
const proc = spawn(chrome, ["--headless=new", "--enable-gpu-rasterization", "--ignore-gpu-blocklist", "--use-angle=d3d11",
  `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, `--window-size=${w},${h}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function cleanup() {
  // Wait for Chrome to exit (it holds file locks on Windows), then delete the profile.
  const exited = proc.exitCode !== null ? Promise.resolve() : new Promise((r) => proc.once("exit", r));
  try { proc.kill(); } catch {}
  await Promise.race([exited, sleep(5000)]);
  for (let i = 0; i < 40; i++) {
    try { rmSync(prof, { recursive: true, force: true }); return; } catch { await sleep(250); }
  }
}
process.on("uncaughtException", async (e) => { console.error(e); await cleanup(); process.exit(1); });
setTimeout(async () => { console.error("timeout"); await cleanup(); process.exit(1); }, 240000).unref();

let targets;
for (let i = 0; i < 60; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find((t) => t.type === "page")) break; } catch {}
  await sleep(200);
}
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map(); const errors = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value).join(" "));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;

await send("Runtime.enable");
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: +w, height: +h, deviceScaleFactor: +dpr, mobile: false });
const sep = url.includes("?") ? "&" : "?";
await send("Page.navigate", { url: `${url}${sep}off=preloader&debug=fps` });
await sleep(6000); // load + intro + decode
await send("Emulation.setCPUThrottlingRate", { rate: +cpu });
await sleep(1000);

const gpu = await evaluate(`(() => { const c = document.createElement('canvas').getContext('webgl'); const e = c && c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a' })()`);

async function wheel(totalDelta, steps) {
  const per = totalDelta / steps;
  for (let i = 0; i < steps; i++) {
    await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: +w / 2, y: +h / 2, deltaX: 0, deltaY: per });
    await sleep(16);
  }
}
const vh = +h;
const results = [];
async function scenario(name, fn) {
  await evaluate("window.__fps && window.__fps.reset()");
  await fn();
  const s = await evaluate("window.__fps ? window.__fps.stats() : null");
  results.push({ name, ...s });
  console.log(JSON.stringify({ name, ...s }));
}
await scenario("idle hero (4s)", () => sleep(4000));
// one transition = 1.6 vh of scroll; wheel ~1.7vh over ~1.3 s, then let Lenis/snap settle
const PROFILE = process.env.PROFILE === "1";
const TRACE = process.env.TRACE === "1";
const traceEvents = [];
// TRACE=1 / PROFILE=1 probe one scenario: TRACE_ON=hero (default) or TRACE_ON=content
const PROBE_ON = process.env.TRACE_ON === 'content' ? 'scroll content sections' : 'scroll hero→tranquility';
let probeLabel = '';
async function startProbe() {
if (TRACE) {
  ws.addEventListener("message", (ev) => { const m = JSON.parse(ev.data); if (m.method === "Tracing.dataCollected") traceEvents.push(...m.params.value); });
  await send("Tracing.start", { categories: "devtools.timeline,disabled-by-default-devtools.timeline,blink,cc,gpu", transferMode: "ReportEvents" });
}
if (PROFILE) { await send("Profiler.enable"); await send("Profiler.setSamplingInterval", { interval: 200 }); await send("Profiler.start"); }
}
async function endProbe() {
if (TRACE) {
  const done = new Promise((r) => ws.addEventListener("message", (ev) => { if (JSON.parse(ev.data).method === "Tracing.tracingComplete") r(); }));
  await send("Tracing.end"); await done;
  if (process.env.TRACE_OUT) { const { writeFileSync } = await import("node:fs"); writeFileSync(process.env.TRACE_OUT, JSON.stringify(traceEvents)); }
  const main = traceEvents.find((e) => e.name === "thread_name" && e.args?.name === "CrRendererMain");
  const sum = new Map();
  for (const e of traceEvents) {
    if (e.ph !== "X" || !e.dur) continue;
    const onMain = main && e.pid === main.pid && e.tid === main.tid;
    const key = `${onMain ? "main" : "other"} · ${e.name}`;
    sum.set(key, (sum.get(key) ?? 0) + e.dur / 1000);
  }
  // long main-thread tasks and what is inside them
  const mainEv = traceEvents.filter((e) => main && e.pid === main.pid && e.tid === main.tid && e.ph === "X" && e.dur);
  const longTasks = mainEv.filter((e) => e.name === "RunTask" && e.dur > 40000).sort((a, b) => b.dur - a.dur).slice(0, 6);
  for (const t of longTasks) {
    const inner = mainEv.filter((e) => e !== t && e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur && e.name !== "RunTask");
    const agg = new Map();
    for (const e of inner) agg.set(e.name, Math.max(agg.get(e.name) ?? 0, e.dur / 1000));
    const top = [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([n, v]) => `${n} ${v.toFixed(0)}`).join(" | ");
    const fn = inner
      .filter((e) => e.name === "FunctionCall" && e.args?.data?.url)
      .sort((a, b) => b.dur - a.dur)
      .slice(0, 3)
      .map((e) => `${e.args.data.functionName || "?"}@${String(e.args.data.url).split("/").pop()}:${e.args.data.lineNumber} ${(e.dur / 1000).toFixed(0)}ms`)
      .join(", ");
    console.log(`LONG TASK ${(t.dur / 1000).toFixed(0)} ms: ${top}${fn ? `\n    calls: ${fn}` : ""}`);
  }
  console.log("\nTrace (${probeLabel}), total ms by event:");
  for (const [k, v] of [...sum.entries()].sort((a, b) => b[1] - a[1]).slice(0, 28)) console.log(`${v.toFixed(0).padStart(7)}  ${k}`);
}
if (PROFILE) {
  const { result } = await send("Profiler.stop");
  const nodes = result.profile.nodes, self = new Map(), byId = new Map(nodes.map((n) => [n.id, n]));
  const dt = result.profile.timeDeltas, samples = result.profile.samples;
  for (let i = 0; i < samples.length; i++) { const n = byId.get(samples[i]); const cf = n.callFrame; const key = `${cf.functionName || "(anon)"} ${cf.url.split("/").pop()}:${cf.lineNumber + 1}`; self.set(key, (self.get(key) ?? 0) + (dt[i] ?? 0) / 1000); }
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  console.log("\nTop self time during ${probeLabel} (ms, % of samples):");
  for (const [k, v] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 22)) console.log(`${v.toFixed(0).padStart(6)}  ${((v / total) * 100).toFixed(1).padStart(5)}%  ${k}`);
}
}
async function probed(name, fn) {
  if (name === PROBE_ON) { probeLabel = name; await startProbe(); await scenario(name, fn); await endProbe(); }
  else await scenario(name, fn);
}
await probed("scroll hero→tranquility", async () => { await wheel(vh * 1.7, 80); await sleep(1800); });
await scenario("scroll tranquility→biodiversity", async () => { await wheel(vh * 1.7, 80); await sleep(1800); });
// content sections below the scenes (reveals, counters, carousel, fireflies, ambient drift)
await probed("scroll content sections", async () => { await wheel(vh * 7, 220); await sleep(1800); });
await scenario("scroll back to hero", async () => {
  const y = (await evaluate("window.scrollY")) ?? vh * 10;
  await wheel(-(y + vh), Math.max(120, Math.round(y / vh) * 24));
  await sleep(2200);
});

if (process.env.TICKS === "1") {
  const slow = (await evaluate("JSON.stringify((window.__tickSlow||[]).sort((a,b)=>b.ms-a.ms).slice(0,12))")) ?? "[]";
  console.log("\nslow ticker callbacks (> 8 ms):");
  for (const t of JSON.parse(slow)) console.log(`${String(t.ms).padStart(6)} ms  ${t.src}`);
}
console.log(`\n${label ? `**${label}** · ` : ""}${w}×${h} @${dpr}x · CPU ${cpu}× slowdown · GPU: ${gpu}\n`);
console.log("| scenario | frames | fps | p50 ms | p95 ms | p99 ms | max ms | frames >50ms |");
console.log("|---|---|---|---|---|---|---|---|");
for (const r of results) console.log(`| ${r.name} | ${r.frames} | ${r.fps} | ${r.p50} | ${r.p95} | ${r.p99} | ${r.max} | ${r.long} |`);
console.log(errors.length ? `\nconsole errors:\n${errors.join("\n")}` : "\nno console errors");
ws.close();
await cleanup();
process.exit(0);
