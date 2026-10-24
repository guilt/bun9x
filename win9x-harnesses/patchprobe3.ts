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
  if (globalThis.__patched3) return "already";
  globalThis.__patched3 = true;
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
  const G = globalThis;
  // Array
  const AP = G.Array.prototype;
  for (const m of ["push","pop","shift","unshift","slice","splice","concat","join","indexOf","includes","forEach","map","filter","find","findIndex","reduce","reduceRight","some","every","flat","flatMap","reverse","sort","fill","copyWithin","at","keys","values","entries","SymbolIterator"]) {
    if (m === "SymbolIterator") { try { wrap(AP, Symbol.iterator, "Array[@@iterator]"); } catch(e){} continue; }
    wrap(AP, m, "Array." + m);
  }
  // Object statics
  for (const m of ["keys","values","entries","assign","freeze","fromEntries","create","defineProperty","getPrototypeOf","setPrototypeOf","isFrozen"]) wrap(G.Object, m, "Object." + m);
  // Map/Set
  for (const m of ["get","set","has","delete","clear","keys","values","entries","forEach","size"]) wrap(G.Map.prototype, m, "Map." + m);
  for (const m of ["add","has","delete","clear","keys","values","entries","forEach"]) wrap(G.Set.prototype, m, "Set." + m);
  wrap(G.Map, "prototype" in G.Map ? "name" : "name", "Map.name"); // noop-ish guard
  // Map/Set constructors
  try {
    const RealMap = G.Map;
    G.Map = new Proxy(RealMap, { construct(t, a, n) { globalThis.__hits["newMap"]=(globalThis.__hits["newMap"]||0)+1; if(!globalThis.__samples["newMap"]){try{globalThis.__samples["newMap"]=String(new Error().stack||"").split("\n").slice(1,14).join("\n");}catch(e){}} return Reflect.construct(t,a,n); } });
  } catch (e) {}
  try {
    const RealSet = G.Set;
    G.Set = new Proxy(RealSet, { construct(t, a, n) { globalThis.__hits["newSet"]=(globalThis.__hits["newSet"]||0)+1; if(!globalThis.__samples["newSet"]){try{globalThis.__samples["newSet"]=String(new Error().stack||"").split("\n").slice(1,14).join("\n");}catch(e){}} return Reflect.construct(t,a,n); } });
  } catch (e) {}
  // String
  const SP = G.String.prototype;
  for (const m of ["slice","substr","substring","concat","replace","replaceAll","split","trim","toLowerCase","toUpperCase","indexOf","includes","startsWith","endsWith","repeat","padStart","padEnd","charAt","charCodeAt","codePointAt","normalize"]) wrap(SP, m, "String." + m);
  try { wrap(SP, Symbol.iterator, "String[@@iterator]"); } catch (e) {}
  // RegExp
  try { wrap(G.RegExp.prototype, "exec", "RegExp.exec"); } catch (e) {}
  try { wrap(G.RegExp.prototype, "test", "RegExp.test"); } catch (e) {}
  // misc common
  wrap(G.JSON, "stringify", "JSON.stringify");
  wrap(G.JSON, "parse", "JSON.parse");
  wrap(G, "parseInt", "parseInt");
  wrap(G, "parseFloat", "parseFloat");
  wrap(G, "isNaN", "isNaN");
  wrap(G, "encodeURIComponent", "encodeURIComponent");
  wrap(G, "decodeURIComponent", "decodeURIComponent");
  try { wrap(G.WeakRef.prototype, "deref", "WeakRef.deref"); } catch (e) {}
  try { wrap(G.FinalizationRegistry.prototype, "register", "FinalizationRegistry.register"); } catch (e) {}
  // Bun intrinsics
  try { wrap(G.Bun, "file", "Bun.file"); } catch (e) {}
  try { wrap(G.Bun, "sleep", "Bun.sleep"); } catch (e) {}
  try { wrap(G.Bun, "gc", "Bun.gc"); } catch (e) {}
  try { wrap(G.Bun, "hash", "Bun.hash"); } catch (e) {}
  try { wrap(G.Bun, "spawn", "Bun.spawn"); } catch (e) {}
  try { wrap(G.Bun, "spawnSync", "Bun.spawnSync"); } catch (e) {}
  try { wrap(G.Bun, "write", "Bun.write"); } catch (e) {}
  try { wrap(G.Bun, "serve", "Bun.serve"); } catch (e) {}
  return "patched3";
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
