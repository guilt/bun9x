import { spawn } from "child_process"
const exe = "D:\\WS\\OpenCode\\packages\\opencode\\dist\\opencode-windows-x86\\bin\\opencode.exe"
const child = spawn(exe, ["serve", "--port", "4317"], {
  cwd: "D:\\WS\\OpenCode\\packages\\opencode\\dist\\opencode-windows-x86\\bin",
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, JSC_logGC: "1" },
})
let err = ""
let out = ""
child.stderr!.on("data", (d) => { err += String(d) })
child.stdout!.on("data", (d) => { out += String(d) })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
// find only our spawned tree (wrapper -> cmd.exe -> re-exec child); cmd.exe
// must be in the filter or the chain walk stops at the intermediate and the
// serving child is never sampled.
async function procs(root: number) {
  const ps = spawn("powershell", ["-NoProfile", "-Command",
    `Get-CimInstance Win32_Process -Filter "Name='opencode.exe' or Name='cmd.exe'" | ForEach-Object { [PSCustomObject]@{ ProcessId = $_.ProcessId; ParentProcessId = $_.ParentProcessId; CPU = ($_.KernelModeTime + $_.UserModeTime)/1e7; WS = $_.WorkingSetSize } } | ConvertTo-Json -Compress`],
    { stdio: ["ignore", "pipe", "pipe"] })
  const out = await new Promise<string>((res) => { let o = ""; ps.stdout!.on("data", (d) => o += d); ps.on("exit", () => res(o)) })
  if (out.trim().length < 3) console.log("procs raw empty:", JSON.stringify(out))
  let rows: Array<{ ProcessId: number; ParentProcessId: number; CPU: number; WS: number }> = []
  try { rows = JSON.parse(out.trim() || "[]") } catch { console.log("procs parse fail:", out.slice(0, 200)); return [] }
  if (!Array.isArray(rows)) rows = [rows]
  const byParent = new Map<number, number[]>()
  for (const r of rows) {
    const list = byParent.get(r.ParentProcessId) || []
    list.push(r.ProcessId)
    byParent.set(r.ParentProcessId, list)
  }
  const ids = new Set<number>([root])
  const queue = [root]
  while (queue.length) {
    const p = queue.pop()!
    for (const c of byParent.get(p) || []) { ids.add(c); queue.push(c) }
  }
  return rows.filter((r) => ids.has(r.ProcessId))
}
// double-boot (wrapper + child) needs more time; use raw http (no proxy env)
import { get } from "node:http"
let resp: string | number = "timeout"
for (let i = 0; i < 10; i++) {
  await sleep(2000)
  resp = await new Promise<string | number>((res) => {
    const req = get("http://127.0.0.1:4317/doc", (r) => { r.resume(); res(r.statusCode ?? 0) })
    req.on("error", (e) => res("ERR " + e.message))
    req.setTimeout(3000, () => { req.destroy(); res("timeout") })
  })
  if (typeof resp === "number") break
}
console.log("server /doc status:", resp)
// Mark steady-state start: GC lines before this point are startup noise.
const errMark = err.length
const before = await procs(child.pid!)
console.log("processes:", JSON.stringify(before))
await sleep(15000)
const after = await procs(child.pid!)
console.log("processes after 15s:", JSON.stringify(after))
for (const a of after) {
  const b = before.find((x) => x.ProcessId === a.ProcessId)
  const dCpu = b ? a.CPU - b.CPU : 0
  console.log(`pid=${a.ProcessId} cpuDelta=${dCpu.toFixed(2)}s (${(dCpu / 15 * 100).toFixed(1)}%) WS=${(a.WS / 1048576).toFixed(0)}MB`)
}
let totalPct = 0
for (const a of after) {
  const b = before.find((x) => x.ProcessId === a.ProcessId)
  if (b) totalPct += (a.CPU - b.CPU) / 15 * 100
}
console.log(`TREE total steady CPU: ${totalPct.toFixed(1)}%`)
// steady-window only: startup GCs (boot, first request) are excluded
const steady = err.slice(errMark).split("\n")
const req = steady.filter((l) => l.includes("Requesting GC")).length
const ends = steady.filter((l) => l.includes("GC END")).length
console.log(`GC over 15s steady window: requesting=${req} ends=${ends}`)
console.log("child stdout tail:", out.split("\n").slice(-6).join(" | "))
console.log("child stderr tail:", err.split("\n").slice(-8).join(" | "))
console.log("wrapper exitCode:", child.exitCode, "killed:", child.killed)
// raw snapshot of the whole tree (opencode + cmd intermediates) with cmdline
const ps2 = spawn("powershell", ["-NoProfile", "-Command",
  `Get-CimInstance Win32_Process -Filter "Name='opencode.exe' or Name='cmd.exe'" | ForEach-Object { [PSCustomObject]@{ Pid = $_.ProcessId; PPid = $_.ParentProcessId; Name = $_.Name; Cmd = $_.CommandLine } } | ConvertTo-Json -Compress`],
  { stdio: ["ignore", "pipe", "pipe"] })
const raw = await new Promise<string>((res) => { let o = ""; ps2.stdout!.on("data", (d) => o += d); ps2.on("exit", () => res(o)) })
console.log("raw procs:", raw.slice(0, 800))
console.log("parent pid:", child.pid)
// Kill only the spawned tree: the direct child plus any opencode.exe whose
// parent chain leads back to our spawned pid. Never kill by name.
async function descendants(root: number): Promise<number[]> {
  // cmd.exe must be in the filter too — the re-exec child's parent chain
  // goes root -> cmd.exe -> child; without cmd.exe the walk stops at the
  // intermediate and the serving child is never killed (orphaned server).
  const ps = spawn("powershell", ["-NoProfile", "-Command",
    `Get-CimInstance Win32_Process -Filter "Name='opencode.exe' or Name='cmd.exe'" | ForEach-Object { [PSCustomObject]@{ ProcessId = $_.ProcessId; ParentProcessId = $_.ParentProcessId } } | ConvertTo-Json -Compress`],
    { stdio: ["ignore", "pipe", "pipe"] })
  const out = await new Promise<string>((res) => { let o = ""; ps.stdout!.on("data", (d) => o += d); ps.on("exit", () => res(o)) })
  let rows: Array<{ ProcessId: number; ParentProcessId: number }> = []
  try { rows = JSON.parse(out.trim() || "[]") } catch { return [] }
  if (!Array.isArray(rows)) rows = [rows]
  const byParent = new Map<number, number[]>()
  for (const r of rows) {
    const list = byParent.get(r.ParentProcessId) || []
    list.push(r.ProcessId)
    byParent.set(r.ParentProcessId, list)
  }
  const found: number[] = []
  const queue = [root]
  while (queue.length) {
    const p = queue.pop()!
    for (const c of byParent.get(p) || []) { found.push(c); queue.push(c) }
  }
  return found
}
const kids = await descendants(child.pid!)
console.log("killing parent", child.pid, "descendants", kids.join(","))
child.kill("SIGKILL")
for (const k of kids) {
  try { process.kill(k, "SIGKILL") } catch {}
}
await sleep(300)
process.exit(0)
