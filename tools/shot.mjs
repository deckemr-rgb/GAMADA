// usage: node tools/shot.mjs <url> <out.png> <width> <height> <mobile 0|1> [scrollY] [fullPage 0|1] [waitMs] [evalJsBeforeShot]
// Launches headless Chrome via CDP, prints {scrollWidth, clientWidth, scrollHeight} and console errors.
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [url, out, w, h, mobile, scrollY = "0", full = "0", waitMs = "3500", evalJs = ""] = process.argv.slice(2);
const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const port = 9300 + Math.floor(Math.random() * 500);
const prof = mkdtempSync(join(tmpdir(), "cdp-"));
const proc = spawn(chrome, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Always remove the throw-away Chrome profile (each one is tens of MB).
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
process.on("unhandledRejection", async (e) => { console.error(e); await cleanup(); process.exit(1); });
setTimeout(async () => { console.error("timeout"); await cleanup(); process.exit(1); }, 120000).unref();

let targets;
for (let i = 0; i < 50; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find(t => t.type === "page")) break; } catch {}
  await sleep(200);
}
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map(); const logs = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") logs.push("EXC " + JSON.stringify(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") logs.push("ERR " + m.params.args.map(a => a.value).join(" "));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: +w, height: +h, deviceScaleFactor: 1, mobile: mobile === "1" });
if (mobile === "1") await send("Emulation.setTouchEmulationEnabled", { enabled: true });
await send("Page.enable");
await send("Page.navigate", { url });
await sleep(+waitMs);
if (evalJs) { const r = await send("Runtime.evaluate", { expression: evalJs, awaitPromise: true, returnByValue: true }); console.log("eval:", JSON.stringify(r.result?.result?.value ?? r.result?.exceptionDetails?.text ?? null)); await sleep(800); }
if (+scrollY) { await send("Runtime.evaluate", { expression: `document.documentElement.style.scrollBehavior='auto';window.scrollTo(0, ${scrollY})` }); await sleep(2200); }
const info = await send("Runtime.evaluate", { expression: "JSON.stringify({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sh: document.documentElement.scrollHeight})", returnByValue: true });
const params = { format: "png" };
if (full === "1") {
  const { sh } = JSON.parse(info.result.result.value);
  await send("Emulation.setDeviceMetricsOverride", { width: +w, height: sh, deviceScaleFactor: 1, mobile: mobile === "1" });
  await sleep(1500);
}
const shot = await send("Page.captureScreenshot", params);
writeFileSync(out, Buffer.from(shot.result.data, "base64"));
console.log(info.result.result.value, logs.join("\n") || "no console errors");
ws.close();
await cleanup();
process.exit(0);
