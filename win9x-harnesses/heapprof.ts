import { spawn } from "child_process"
import { writeFileSync } from "fs"
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
const events: any[] = []
ws.onmessage = (ev) => {
  const msg = JSON.parse(String(ev.data))
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)!.res(msg); pending.delete(msg.id) }
  else if (msg.method) { events.push(msg); if (!msg.method.includes("scriptParsed")) console.log("evt:", msg.method) }
}
const send = (method: string, params: any = {}) => {
  const msgId = ++id
  return new Promise<any>((res) => { pending.set(msgId, { res }); ws.send(JSON.stringify({ id: msgId, method, params })) })
}
const waitEvent = (name: string, timeout = 30000) => {
  const t0 = Date.now()
  return new Promise<any>((res) => {
    const tick = () => {
      const i = events.findIndex((e) => e.method === name)
      if (i >= 0) return res(events.splice(i, 1)[0])
      if (Date.now() - t0 > timeout) return res(null)
      setTimeout(tick, 20)
    }
    tick()
  })
}

console.log("Heap.enable:", JSON.stringify(await send("Heap.enable")))
console.log("Heap.gc:", JSON.stringify(await send("Heap.gc")))
await sleep(1000)
console.log("Heap.snapshot A...")
const a = await send("Heap.snapshot")
console.log("A size:", a.result?.snapshotData?.length, "ts:", a.result?.timestamp)
if (a.result?.snapshotData) writeFileSync(`${dir}\\snapA.json`, a.result.snapshotData)

console.log("waiting 30s in steady state...")
await sleep(30000)

console.log("Heap.gc:", JSON.stringify(await send("Heap.gc")))
await sleep(1000)
console.log("Heap.snapshot B...")
const b = await send("Heap.snapshot")
console.log("B size:", b.result?.snapshotData?.length, "ts:", b.result?.timestamp)
if (b.result?.snapshotData) writeFileSync(`${dir}\\snapB.json`, b.result.snapshotData)

child.kill("SIGKILL")
process.exit(0)
