import { spawn } from "child_process"
import { writeFileSync } from "fs"

const dir = "D:\\WS\\OpenCode\\packages\\opencode\\dist\\opencode-windows-x86\\bin"
const exe = `${dir}\\opencode.exe`
const out = `${dir}\\pause-samples.txt`
const PORT = 9230

const child = spawn(exe, ["serve", "--port", "4315"], {
  cwd: dir,
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, BUN_INSPECT: `127.0.0.1:${PORT}/prof` },
})
child.stdout.on("data", (d) => process.stdout.write(d))
child.stderr.on("data", (d) => process.stderr.write(d))

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function ready(): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/version`)
    return (await res.text()).includes("Bun")
  } catch { return false }
}
for (let i = 0; i < 60; i++) { await sleep(500); if (await ready()) break }

const ws = new WebSocket(`ws://127.0.0.1:${PORT}/prof`)
await new Promise<void>((res, rej) => { ws.onopen = () => res(); ws.onerror = (e) => rej(e) })
console.log("ws open")

let id = 0
const pending = new Map<number, { res: (v: any) => void }>()
const events: any[] = []
ws.onmessage = (ev) => {
  const msg = JSON.parse(typeof ev.data === "string" ? ev.data : String(ev.data))
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)!.res(msg); pending.delete(msg.id) }
  else if (msg.method) events.push(msg)
}
const send = (method: string, params: any = {}) => {
  const msgId = ++id
  return new Promise<any>((res) => { pending.set(msgId, { res }); ws.send(JSON.stringify({ id: msgId, method, params })) })
}
const waitEvent = (name: string, timeout = 8000) => {
  const t0 = Date.now()
  return new Promise<any>((res) => {
    const tick = () => {
      const i = events.findIndex((e) => e.method === name)
      if (i >= 0) { const e = events.splice(i, 1)[0]; res(e); return }
      if (Date.now() - t0 > timeout) { res(null); return }
      setTimeout(tick, 5)
    }
    tick()
  })
}

await send("Debugger.enable")
console.log("debugger enabled")

// wait for steady state
await sleep(20000)
console.log("sampling stacks for 30s...")

const stacks = new Map<string, number>()
let caught = 0
let missed = 0
const tEnd = Date.now() + 30000
while (Date.now() < tEnd) {
  const r = await send("Debugger.pause")
  if (r.error) { missed++; await sleep(50); continue }
  const paused = await waitEvent("Debugger.paused", 3000)
  if (!paused) { missed++; await send("Debugger.resume").catch(() => {}); continue }
  const frames = paused.params.callFrames.map(
    (f: any) => `${f.functionName || "<anon>"}@${f.url.replace(/^.*[\\/]/, "")}:${f.lineNumber + 1}:${f.columnNumber + 1}`,
  )
  const key = frames.slice(0, 12).join("\n   <- ")
  stacks.set(key, (stacks.get(key) ?? 0) + 1)
  caught++
  await send("Debugger.resume")
  await sleep(40)
}
console.log(`caught=${caught} missed=${missed}`)

const sorted = [...stacks.entries()].sort((a, b) => b[1] - a[1])
const report = sorted.map(([s, n]) => `=== ${n} samples ===\n   <- ${s}`).join("\n\n")
writeFileSync(out, report)
console.log("unique stacks:", sorted.length)
console.log(report.slice(0, 3000))

ws.close()
child.kill("SIGKILL")
await sleep(500)
process.exit(0)
