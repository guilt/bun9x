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
await send("Runtime.enable")

const patch = String.raw`
(() => {
  if (globalThis.__patched4) return "already";
  globalThis.__patched4 = true;
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
          try { s[label] = String(new Error().stack || "").split("\n").slice(1, 14).join("\n"); } catch (e) {}
        }
        return Reflect.apply(orig, this, a);
      };
      obj[name] = fn;
    } catch (e) {}
  };
  const wrapCtor = (name, label) => {
    try {
      const orig = globalThis[name];
      if (typeof orig !== "function") return;
      const fn = function(...a) {
        const h = globalThis.__hits;
        h[label] = (h[label] || 0) + 1;
        const s = globalThis.__samples;
        if (!s[label]) {
          try { s[label] = String(new Error().stack || "").split("\n").slice(1, 14).join("\n"); } catch (e) {}
        }
        return Reflect.construct(orig, a, new.target || orig);
      };
      Object.defineProperty(fn, "name", { value: orig.name });
      globalThis[name] = fn;
    } catch (e) {}
  };
  const G = globalThis;
  // WeakMap / WeakSet
  for (const m of ["get","set","has","delete"]) wrap(G.WeakMap.prototype, m, "WeakMap." + m);
  for (const m of ["get","set","has","delete"]) wrap(G.WeakSet.prototype, m, "WeakSet." + m);
  // Reflect
  for (const m of ["get","set","has","deleteProperty","apply","construct","defineProperty","getOwnPropertyDescriptor","ownKeys","preventExtensions","isExtensible","getPrototypeOf","setPrototypeOf"]) wrap(G.Reflect, m, "Reflect." + m);
  // Error ctors
  for (const n of ["Error","TypeError","RangeError","SyntaxError","ReferenceError","URIError","EvalError"]) wrapCtor(n, "new" + n);
  // TypedArrays / ArrayBuffer / DataView
  for (const n of ["ArrayBuffer","SharedArrayBuffer","DataView","Int8Array","Uint8Array","Uint8ClampedArray","Int16Array","Uint16Array","Int32Array","Uint32Array","Float32Array","Float64Array","BigInt64Array","BigUint64Array"]) wrapCtor(n, "new" + n);
  for (const m of ["set","slice","subarray","copyWithin","fill","indexOf","join","map","filter"]) {
    wrap(G.Uint8Array.prototype, m, "Uint8Array." + m);
    wrap(G.ArrayBuffer.prototype, m, "ArrayBuffer." + m);
  }
  try { wrap(G.DataView.prototype, "getInt8", "DataView.getInt8"); wrap(G.DataView.prototype, "getUint8", "DataView.getUint8"); wrap(G.DataView.prototype, "setUint8", "DataView.setUint8"); } catch (e) {}
  // Buffer
  try { if (G.Buffer) { wrapCtor("Buffer", "newBuffer"); for (const m of ["concat","slice","toString","copy","fill","write","indexOf"]) wrap(G.Buffer.prototype, m, "Buffer." + m); } } catch (e) {}
  // crypto / hash / compression
  try { wrap(G.crypto?.getRandomValues ? G.crypto : {}, "getRandomValues", "crypto.getRandomValues"); } catch (e) {}
  try { wrap(G.Bun, "hash", "Bun.hash"); } catch (e) {}
  try { wrapCtor("Bun.CryptoHasher", "newCryptoHasher"); } catch (e) {}
  try { const B = G.Bun; wrap(B, "gzipSync", "Bun.gzipSync"); wrap(B, "gunzipSync", "Bun.gunzipSync"); wrap(B, "deflateSync", "Bun.deflateSync"); wrap(B, "inflateSync", "Bun.inflateSync"); wrap(B, "zlibSync", "Bun.zlibSync"); wrap(B, "unzlibSync", "Bun.unzlibSync"); } catch (e) {}
  // misc
  wrap(G.Symbol, "for", "Symbol.for");
  wrap(G.Symbol, "keyFor", "Symbol.keyFor");
  try { wrap(G.Bun, "deepEquals", "Bun.deepEquals"); wrap(G.Bun, "inspect", "Bun.inspect"); } catch (e) {}
  try { wrap(G.Bun, "file", "Bun.file"); } catch (e) {}
  try { wrap(G.performance, "now", "performance.now"); } catch (e) {}
  wrap(G.Date, "now", "Date.now");
  return "patched4";
})()`
console.log("patch:", JSON.stringify(await evaluate(patch)))
await evaluate(`(() => { globalThis.__hits = {}; globalThis.__samples = {}; return "reset"; })()`)

for (let round = 1; round <= 4; round++) {
  await sleep(5000)
  const hits = await evaluate(`JSON.stringify(globalThis.__hits)`)
  console.log(`\n--- t+${round * 5}s hits:`, typeof hits === "string" ? hits : JSON.stringify(hits))
}
console.log("\n=== STACK SAMPLES ===")
const samples = await evaluate(`JSON.stringify(globalThis.__samples)`)
if (typeof samples === "string") {
  const obj = JSON.parse(samples)
  for (const [k, v] of Object.entries(obj)) console.log(`\n[${k}]\n${v}`)
}
child.kill("SIGKILL")
process.exit(0)
