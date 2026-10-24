import { spawn } from "child_process"

const exe = "D:\\WS\\OpenCode\\packages\\opencode\\dist\\opencode-windows-x86\\bin\\opencode.exe"
const child = spawn(exe, ["serve", "--port", "4324"], {
  cwd: "D:\\WS\\OpenCode\\packages\\opencode\\dist\\opencode-windows-x86\\bin",
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    OPENCODE_BURN_STAGE: "2",
    BUN_INSPECT: "9230",
    JSC_largeHeapGrowthFactor: "2",
    JSC_mediumHeapGrowthFactor: "2",
    JSC_smallHeapGrowthFactor: "2",
    JSC_miniVMHeapGrowthFactor: "2",
  },
})
let err = ""
child.stderr!.on("data", (d) => { err += String(d) })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

let target: string | undefined
for (let i = 0; i < 30; i++) {
  await sleep(1000)
  try {
    const r = await fetch("http://127.0.0.1:9230/json/list")
    const list = (await r.json()) as Array<{ webSocketDebuggerUrl?: string }>
    target = list[0]?.webSocketDebuggerUrl
    if (target) break
  } catch {}
}
if (!target) {
  console.log("inspector never came up; stderr tail:", err.split("\n").slice(-5).join(" | "))
  child.kill("SIGKILL")
  process.exit(1)
}
console.log("inspector up:", target)

const ws = new WebSocket(target)
await new Promise<void>((res, rej) => { ws.onopen = () => res(); ws.onerror = (e) => rej(e) })
let id = 0
const pending = new Map<number, (v: any) => void>()
ws.onmessage = (ev) => {
  const msg = JSON.parse(String(ev.data))
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)!(msg.result); pending.delete(msg.id) }
}
const send = (method: string, params: object = {}) =>
  new Promise<any>((res) => {
    const i = ++id
    pending.set(i, res)
    ws.send(JSON.stringify({ id: i, method, params }))
  })

await send("Profiler.enable")
await send("Profiler.setSamplingInterval", { interval: 100 })
await send("Profiler.start")
console.log("profiling 12s...")
await sleep(12000)
const stop = await send("Profiler.stop")
ws.close()
child.kill("SIGKILL")

const prof = stop?.profile
if (!prof?.samples?.length) { console.log("no samples", JSON.stringify(stop).slice(0, 200)); process.exit(1) }
const nodes = new Map<number, any>()
for (const n of prof.nodes) nodes.set(n.id, n)
const selfMs = new Map<string, number>()
for (let i = 0; i < prof.samples.length; i++) {
  const n = nodes.get(prof.samples[i])
  if (!n) continue
  const cf = n.callFrame
  const key = `${cf.functionName || "(anon)"} ${cf.url || "(native)"}:${cf.lineNumber ?? "?"}`
  selfMs.set(key, (selfMs.get(key) ?? 0) + (prof.timeDeltas[i] ?? 0) / 1000)
}
const top = [...selfMs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
const total = [...selfMs.values()].reduce((s, v) => s + v, 0)
console.log(`samples=${prof.samples.length} profiledMs≈${Math.round(total)}`)
for (const [k, v] of top) console.log(`  ${v.toFixed(0).padStart(6)}ms ${(v / total * 100).toFixed(1).padStart(5)}%  ${k}`)
process.exit(0)
