import { spawn } from "child_process"
const dir = "D:\\WS\\OpenCode\\packages\\opencode\\dist\\opencode-windows-x86\\bin"
const child = spawn(dir + "\\opencode.exe", ["serve", "--port", "4317"], {
  cwd: dir, stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, BUN_INSPECT: "127.0.0.1:9230/prof" },
})
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
await sleep(5000)
const ws = new WebSocket("ws://127.0.0.1:9230/prof")
await new Promise((res, rej) => { ws.onopen = res as any; ws.onerror = rej })
console.log("open, pid", child.pid)
let id = 0
const pending = new Map<number, { res: (v: any) => void }>()
let scriptParsedCount = 0
ws.onmessage = (ev) => {
  const msg = JSON.parse(String(ev.data))
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)!.res(msg); pending.delete(msg.id) }
  else if (msg.method === "Debugger.scriptParsed") scriptParsedCount++
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

await send("Runtime.enable")
await send("Debugger.enable") // for scriptParsed counting

const patch = String.raw`
(() => {
  if (globalThis.__patched2) return "already";
  globalThis.__patched2 = true;
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
        if (!s[label]) {
          try { s[label] = String(new Error().stack || "").split("\n").slice(1, 12).join("\n"); } catch (e) {}
        }
        return Reflect.apply(orig, this, a);
      };
      obj[name] = fn;
    } catch (e) {}
  };
  const G = globalThis;
  // eval + Function constructors
  wrap(G, "eval", "eval");
  wrap(G, "Function", "Function");
  // timers + scheduling
  wrap(G, "setTimeout", "setTimeout");
  wrap(G, "setImmediate", "setImmediate");
  wrap(G, "queueMicrotask", "queueMicrotask");
  // Promise ctor via proxy
  try {
    const RealPromise = G.Promise;
    const P = new Proxy(RealPromise, {
      construct(target, args, nt) { globalThis.__hits["newPromise"] = (globalThis.__hits["newPromise"]||0)+1; if(!globalThis.__samples["newPromise"]) { try { globalThis.__samples["newPromise"] = String(new Error().stack||"").split("\n").slice(1,12).join("\n"); } catch(e){} } return Reflect.construct(target, args, nt); }
    });
    G.Promise = P;
    // keep thenable interop working
    Object.defineProperty(P, "prototype", { value: RealPromise.prototype });
  } catch (e) {}
  // EventEmitter / streams / process
  try { const ee = G.process?.events?.EventEmitter || G.require?.("events")?.EventEmitter; } catch (e) {}
  try {
    const eventsMod = G.process.binding ? null : null;
  } catch (e) {}
  // Bun exposes EventEmitter? try node:events via createRequire
  try {
    const cr = G.Bun?.resolveSync ? null : null;
  } catch (e) {}
  try { wrap(G.process, "emit", "process.emit"); } catch (e) {}
  try { wrap(G.process, "nextTick", "process.nextTick"); } catch (e) {}
  // Readable/Writable if exposed on process
  try { const R = G.Readable; if (R) { wrap(R.prototype, "read", "Readable.read"); wrap(R.prototype, "on", "Readable.on"); } } catch (e) {}
  try { const W = G.Writable; if (W) { wrap(W.prototype, "write", "Writable.write"); } } catch (e) {}
  try { const S = G.Socket; if (S) { wrap(S.prototype, "write", "Socket.write"); wrap(S.prototype, "on", "Socket.on"); } } catch (e) {}
  return "patched2";
})()`
console.log("patch:", JSON.stringify(await evaluate(patch)))

async function cpuMs() {
  const r = await evaluate(`(async () => 1)()`)
  const ps = spawn("powershell", ["-NoProfile", "-Command", `(Get-Process -Id ${child.pid}).CPU`], { stdio: ["ignore", "pipe", "pipe"] })
  const out = await new Promise<string>((res) => { let o = ""; ps.stdout.on("data", (d) => o += d); ps.on("exit", () => res(o.trim())) })
  const v = parseFloat(out)
  return isNaN(v) ? -1 : v * 1000
}

await evaluate(`(() => { globalThis.__hits = {}; globalThis.__samples = {}; return "reset"; })()`)
let prevCpu = await cpuMs()
let prevParsed = scriptParsedCount
console.log("cpuMs at start:", prevCpu, "scriptParsed so far:", prevParsed)

for (let round = 1; round <= 5; round++) {
  await sleep(5000)
  const cpu = await cpuMs()
  const parsed = scriptParsedCount
  const hits = await evaluate(`JSON.stringify(globalThis.__hits)`)
  console.log(`\n--- t+${round * 5}s: cpuDelta=${(cpu - prevCpu).toFixed(0)}ms scriptParsedDelta=${parsed - prevParsed}`)
  console.log("hits:", typeof hits === "string" ? hits : JSON.stringify(hits))
  prevCpu = cpu
  prevParsed = parsed
}

console.log("\n=== STACK SAMPLES ===")
const samples = await evaluate(`JSON.stringify(globalThis.__samples)`)
if (typeof samples === "string") {
  const obj = JSON.parse(samples)
  for (const [k, v] of Object.entries(obj)) console.log(`\n[${k}]\n${v}`)
}

child.kill("SIGKILL")
process.exit(0)
