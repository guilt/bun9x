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
ws.onmessage = (ev) => {
  const s = String(ev.data)
  if (!s.includes("scriptParsed")) console.log("<<", s.slice(0, 400))
}
ws.send(JSON.stringify({ id: 1, method: "Console.enable" }))
ws.send(JSON.stringify({ id: 2, method: "Runtime.enable" }))
ws.send(JSON.stringify({ id: 3, method: "Debugger.enable" }))
await sleep(1500)

console.log("--- console.log event flow test ---")
ws.send(JSON.stringify({ id: 10, method: "Runtime.evaluate", params: { expression: `console.log("INSPECTOR_EVENT_TEST")` } }))
await sleep(1500)

console.log("--- http before pause ---")
let t0 = Date.now()
try {
  const r = await fetch("http://127.0.0.1:4317/", { signal: AbortSignal.timeout(3000) })
  console.log("HTTP", r.status, Date.now() - t0, "ms")
} catch (e: any) { console.log("HTTP fail", e.name, Date.now() - t0) }

console.log("--- send pause ---")
ws.send(JSON.stringify({ id: 4, method: "Debugger.pause" }))
await sleep(1500)
t0 = Date.now()
try {
  const r = await fetch("http://127.0.0.1:4317/", { signal: AbortSignal.timeout(4000) })
  console.log("HTTP-DURING-PAUSE", r.status, Date.now() - t0, "ms")
} catch (e: any) { console.log("HTTP-DURING-PAUSE fail", e.name, Date.now() - t0, "ms") }

ws.send(JSON.stringify({ id: 5, method: "Debugger.resume" }))
await sleep(500)
child.kill("SIGKILL")
process.exit(0)
