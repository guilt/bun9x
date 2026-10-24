import { spawn } from "child_process"
const dir = "D:\\WS\\OpenCode\\packages\\opencode\\dist\\opencode-windows-x86\\bin"
const child = spawn(dir + "\\opencode.exe", ["serve", "--port", "4317"], {
  cwd: dir, stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, BUN_INSPECT: "127.0.0.1:9230/prof" },
})
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
await sleep(7000)
const ws = new WebSocket("ws://127.0.0.1:9230/prof")
await new Promise((res, rej) => { ws.onopen = res as any; ws.onerror = rej })
console.log("open")
let id = 0
const pending = new Map<number, { res: (v: any) => void }>()
ws.onmessage = (ev) => {
  const msg = JSON.parse(String(ev.data))
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)!.res(msg); pending.delete(msg.id) }
}
const send = (method: string, params: any = {}) => {
  const msgId = ++id
  return new Promise<any>((res) => { pending.set(msgId, { res }); ws.send(JSON.stringify({ id: msgId, method, params })) })
}
const evaluate = async (expr: string) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, silent: true })
  if (r.result?.wasThrown) return { err: r.result?.result?.description ?? "thrown" }
  return r.result?.result?.value
}

console.log("Runtime.enable:", JSON.stringify(await send("Runtime.enable")))

// install wrappers on every chokepoint; count calls, capture stacks for first N of each
const patch = String.raw`
(() => {
  if (globalThis.__patched) return "already";
  globalThis.__hits = {};
  globalThis.__samples = {};
  const wrap = (obj, name, label) => {
    try {
      const orig = obj[name];
      if (typeof orig !== "function") return;
      const fn = function(...a) {
        const h = globalThis.__hits;
        h[label] = (h[label] || 0) + 1;
        const s = globalThis.__samples;
        if (!s[label] && h[label] >= 1) {
          try { s[label] = String(new Error().stack || "").split("\n").slice(1, 12).join("\n"); } catch (e) {}
        }
        return Reflect.apply(orig, this, a);
      };
      Object.defineProperty(fn, "name", { value: orig.name });
      obj[name] = fn;
    } catch (e) {}
  };
  const G = globalThis;
  wrap(G, "setTimeout", "setTimeout");
  wrap(G, "setInterval", "setInterval");
  wrap(G, "setImmediate", "setImmediate");
  wrap(G, "queueMicrotask", "queueMicrotask");
  wrap(G, "fetch", "fetch");
  wrap(G, "structuredClone", "structuredClone");
  try { wrap(G.performance, "now", "performance.now"); } catch (e) {}
  wrap(Date, "now", "Date.now");
  wrap(JSON, "stringify", "JSON.stringify");
  wrap(JSON, "parse", "JSON.parse");
  wrap(Promise.prototype, "then", "Promise.then");
  wrap(Promise.prototype, "catch", "Promise.catch");
  wrap(Promise.prototype, "finally", "Promise.finally");
  wrap(G, "queueMicrotask", "queueMicrotask2");
  try { wrap(G.process, "nextTick", "process.nextTick"); } catch (e) {}
  try { wrap(G.Bun, "sleep", "Bun.sleep"); } catch (e) {}
  try { wrap(G.TextEncoder.prototype, "encode", "TextEncoder.encode"); } catch (e) {}
  try { wrap(G.TextDecoder.prototype, "decode", "TextDecoder.decode"); } catch (e) {}
  try { wrap(G.URLSearchParams.prototype, "toString", "URLSearchParams.toString"); } catch (e) {}
  try { wrap(G.Headers.prototype, "append", "Headers.append"); } catch (e) {}
  try { wrap(G.Headers.prototype, "get", "Headers.get"); } catch (e) {}
  try { wrap(G.EventTarget.prototype, "dispatchEvent", "dispatchEvent"); } catch (e) {}
  try { wrap(G.EventTarget.prototype, "addEventListener", "addEventListener"); } catch (e) {}
  try { wrap(G.AbortController.prototype, "abort", "AbortController.abort"); } catch (e) {}
  try { wrap(G.console, "log", "console.log"); wrap(G.console, "info", "console.info"); wrap(G.console, "warn", "console.warn"); wrap(G.console, "error", "console.error"); wrap(G.console, "debug", "console.debug"); } catch (e) {}
  return "patched";
})()`
console.log("patch:", JSON.stringify(await evaluate(patch)))

// reset counters to zero now that boot is past (hits object replaced)
await evaluate(`(() => { globalThis.__hits = {}; globalThis.__samples = {}; return "reset"; })()`)

for (let round = 1; round <= 5; round++) {
  await sleep(4000)
  const hits = await evaluate(`JSON.stringify(globalThis.__hits)`)
  console.log(`\n--- t+${round * 4}s hits:`, typeof hits === "string" ? hits : JSON.stringify(hits))
}

console.log("\n=== STACK SAMPLES (nonzero) ===")
const samples = await evaluate(`JSON.stringify(globalThis.__samples)`)
if (typeof samples === "string") {
  const obj = JSON.parse(samples)
  for (const [k, v] of Object.entries(obj)) {
    console.log(`\n[${k}]\n${v}`)
  }
} else console.log(samples)

child.kill("SIGKILL")
process.exit(0)
