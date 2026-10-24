import { spawn } from "child_process"
// Run from SOURCE on i586 bun so effect.js instrumentation applies without rebuild.
const child = spawn("D:\\WS\\Bun\\build\\release-i586\\bun.exe", ["src/index.ts", "serve", "--port", "4325"], {
  cwd: "D:\\WS\\OpenCode\\packages\\opencode", stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, BUN_INSPECT: "127.0.0.1:9231/prof", JSC_logGC: "1", OPENCODE_BURN_STAGE: "2",
    JSC_largeHeapGrowthFactor: "2", JSC_mediumHeapGrowthFactor: "2", JSC_smallHeapGrowthFactor: "2", JSC_miniVMHeapGrowthFactor: "2" },
})
let gcErr = ""
child.stderr!.on("data", (d) => { gcErr += String(d) })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
await sleep(8000)
const ws = new WebSocket("ws://127.0.0.1:9231/prof")
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
console.log("init:", JSON.stringify(await evaluate(`(() => { globalThis.__fxProf = { ops: 0, byOp: {}, byFiber: {} }; return "armed"; })()`)))
for (let i = 0; i < 6; i++) {
  const res = await evaluate(`JSON.stringify(process.getActiveResourcesInfo?.() ?? "missing")`)
  console.log(`handles t+${(i + 1) * 2}s:`, res)
  await sleep(2000)
}
const raw = await evaluate(`JSON.stringify(globalThis.__fxProf)`)
if (typeof raw === "string") {
  const P = JSON.parse(raw)
  console.log("totalOps:", P.ops)
  console.log("top ops:", Object.entries(P.byOp as Record<string, number>).sort((a, b) => b[1] - a[1]).slice(0, 20))
  const slow = Object.entries((P.slow || {}) as Record<string, any>).sort((a, b) => b[1].ms - a[1].ms)
  console.log("=== SLOW OPS (>5ms) ===")
  for (const [op, v] of slow) {
    console.log(`\n[${op}] count=${v.count} totalMs=${v.ms.toFixed(0)} fiber=${v.fiber ?? ""} span=${v.span ?? ""}`)
    console.log(v.frame)
  }
  if (slow.length === 0) console.log("(none)")
  const heap = Object.entries((P.heapByOp || {}) as Record<string, number>).sort((a, b) => b[1] - a[1])
  console.log("=== HEAP GROWTH ATTRIBUTED TO OPS (bytes) ===")
  for (const [op, v] of heap.slice(0, 15)) console.log(`${(v / 1048576).toFixed(2)}MB  [${op}]`)
  if (heap.length === 0) console.log("(none)")
} else console.log(raw)
const req = gcErr.split("\n").filter((l) => l.includes("Requesting GC")).length
const ends = gcErr.split("\n").filter((l) => l.includes("GC END")).length
console.log(`\nGC while attached (~20s): requesting=${req} ends=${ends}`)
child.kill("SIGKILL")
process.exit(0)
