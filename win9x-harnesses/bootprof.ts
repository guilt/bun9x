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
const raw1 = await evaluate(`JSON.stringify(globalThis.__bootProf)`)
await sleep(10000)
const raw2 = await evaluate(`JSON.stringify(globalThis.__bootProf)`)
if (typeof raw1 === "string" && typeof raw2 === "string") {
  const A = JSON.parse(raw1), B = JSON.parse(raw2)
  const rows: Array<[string, number, number]> = []
  for (const k of new Set([...Object.keys(A.hits), ...Object.keys(B.hits)])) {
    const d = (B.hits[k] ?? 0) - (A.hits[k] ?? 0)
    if (d > 0) rows.push([k, d, B.hits[k]])
  }
  rows.sort((x, y) => y[1] - x[1])
  console.log("=== per-10s deltas (label, +delta, total) ===")
  for (const r of rows) console.log(`${r[0]}\t+${r[1]}\ttotal=${r[2]}`)
  console.log("\n=== stacks for top nonzero ===")
  for (const [k] of rows.slice(0, 8)) {
    console.log(`\n[${k}] boot-stack:\n${B.stacks[k] ?? "(none)"}`)
    console.log(`[${k}] late(hit20)-stack:\n${(B.late && B.late[k]) ?? "(none)"}`)
  }
} else console.log(raw1, raw2)
child.kill("SIGKILL")
process.exit(0)
