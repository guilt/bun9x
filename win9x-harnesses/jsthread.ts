import { spawn } from "child_process"
const dir = "D:\\WS\\OpenCode\\packages\\opencode\\dist\\opencode-windows-x86\\bin"
const child = spawn(dir + "\\opencode.exe", ["serve", "--port", "4317"], {
  cwd: dir, stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, BUN_INSPECT: "127.0.0.1:9230/prof" },
})
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
function run(cmd: string) {
  const ps = spawn("powershell", ["-NoProfile", "-Command", cmd], { stdio: ["ignore", "pipe", "pipe"] })
  return new Promise<string>((res) => { let o = ""; ps.stdout.on("data", (d) => o += d); ps.on("exit", () => res(o)) })
}
const snap = () => run(`$p = Get-Process -Id ${child.pid}; $p.Threads | ForEach-Object { "$($_.Id) $($_.TotalProcessorTime.TotalMilliseconds)" }`)
const parse = (s: string) => {
  const m = new Map<string, number>()
  for (const line of s.split("\n")) {
    const [id, ms] = line.trim().split(/\s+/)
    if (id && ms) m.set(id, parseFloat(ms))
  }
  return m
}
const diff = (t1: Map<string, number>, t2: Map<string, number>) => {
  const rows: Array<[string, number]> = []
  for (const [tid, ms] of t2) rows.push([tid, ms - (t1.get(tid) ?? ms)])
  rows.sort((a, b) => b[1] - a[1])
  return rows.filter((r) => r[1] > 20)
}
await sleep(10000) // steady burn
const A = await snap()
await sleep(4000)
const B = await snap()
console.log("idle-burn hot threads over 4s:", diff(parse(A), parse(B)))

// now saturate the JS thread with a busy loop via evaluate (don't await — fire and forget)
const ws = new WebSocket("ws://127.0.0.1:9230/prof")
await new Promise((res, rej) => { ws.onopen = res as any; ws.onerror = rej })
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
await send("Runtime.enable")
// fire busy loop: evaluate returns when done — do NOT await; run for ~4s worth
send("Runtime.evaluate", { expression: `(() => { const t0 = Date.now(); let x = 0; while (Date.now() - t0 < 4000) { for (let i = 0; i < 100000; i++) x += i; } return x; })()`, returnByValue: true })
const C = await snap() // taken right as busy loop starts (approx)
await sleep(4200)
const D = await snap()
console.log("during JS-busy-loop hot threads over ~4s:", diff(parse(C), parse(D)))
child.kill("SIGKILL")
process.exit(0)
