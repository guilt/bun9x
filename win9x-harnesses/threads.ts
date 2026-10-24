import { spawn } from "child_process"
const exe = "D:\\WS\\OpenCode\\packages\\opencode\\dist\\opencode-windows-x86\\bin\\opencode.exe"
const child = spawn(exe, ["serve", "--port", "4318"], {
  cwd: "D:\\WS\\OpenCode\\packages\\opencode\\dist\\opencode-windows-x86\\bin",
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, JSC_logGC: "0" },
})
let out = ""
child.stdout!.on("data", (d) => { out += String(d) })
child.stderr!.on("data", () => {})
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// resolve the re-exec chain: wrapper -> cmd.exe -> serving child
async function tree(root: number) {
  const ps = spawn("powershell", ["-NoProfile", "-Command",
    `Get-CimInstance Win32_Process -Filter "Name='opencode.exe' or Name='cmd.exe'" | ForEach-Object { [PSCustomObject]@{ ProcessId = $_.ProcessId; ParentProcessId = $_.ParentProcessId; Name = $_.Name } } | ConvertTo-Json -Compress`],
    { stdio: ["ignore", "pipe", "pipe"] })
  const o = await new Promise<string>((res) => { let s = ""; ps.stdout!.on("data", (d) => s += d); ps.on("exit", () => res(s)) })
  let rows: Array<{ ProcessId: number; ParentProcessId: number; Name: string }> = []
  try { rows = JSON.parse(o.trim() || "[]") } catch { return [] }
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

import { get } from "node:http"
let resp: string | number = "timeout"
for (let i = 0; i < 10; i++) {
  await sleep(2000)
  resp = await new Promise<string | number>((res) => {
    const req = get("http://127.0.0.1:4318/doc", (r) => { r.resume(); res(r.statusCode ?? 0) })
    req.on("error", (e) => res("ERR " + e.message))
    req.setTimeout(3000, () => { req.destroy(); res("timeout") })
  })
  if (typeof resp === "number") break
}
console.log("server /doc status:", resp)

const t = await tree(child.pid!)
// serving child = leaf: the opencode.exe with no children in the tree
// (wrapper -> cmd.exe -> leaf)
const childPid = t.filter((r) => r.Name === "opencode.exe" && !t.some((c) => c.ParentProcessId === r.ProcessId)).map((r) => r.ProcessId)[0]
console.log("tree:", JSON.stringify(t), "serving child:", childPid)

async function threads(pid: number) {
  // .NET Process.Threads — CIM Win32_Thread WQL filtering is unreliable here
  const ps = spawn("powershell", ["-NoProfile", "-Command",
    `$p=[System.Diagnostics.Process]::GetProcessById(${pid});$p.Refresh();$p.Threads|ForEach-Object{[PSCustomObject]@{Tid=$_.Id;CPU=$_.TotalProcessorTime.TotalSeconds;State=[string]$_.ThreadState;Wait=[string]$_.WaitReason}}|ConvertTo-Json -Compress`],
    { stdio: ["ignore", "pipe", "pipe"] })
  const o = await new Promise<string>((res) => { let s = ""; ps.stdout!.on("data", (d) => s += d); ps.on("exit", () => res(s)) })
  let rows: Array<{ Tid: number; CPU: number; State: string; Wait: string }> = []
  try { rows = JSON.parse(o.trim() || "[]") } catch { return [] }
  if (!Array.isArray(rows)) rows = [rows]
  return rows
}

await sleep(2000)
const b = await threads(childPid)
await sleep(10000)
const a = await threads(childPid)
const deltas = a.map((x) => {
  const y = b.find((z) => z.Tid === x.Tid)
  return { Tid: x.Tid, dCpu: y ? x.CPU - y.CPU : 0, State: x.State, Wait: x.Wait }
}).filter((x) => x.dCpu > 0.05).sort((x, y) => y.dCpu - x.dCpu)
const total = deltas.reduce((s, x) => s + x.dCpu, 0)
console.log(`threads over 10s (total ${total.toFixed(2)}s = ${(total / 10 * 100).toFixed(1)}%):`)
for (const d of deltas.slice(0, 15))
  console.log(`  tid=${d.Tid} cpu=${d.dCpu.toFixed(2)}s (${(d.dCpu / 10 * 100).toFixed(1)}%) state=${d.State} wait=${d.Wait}`)
console.log(`  ... ${deltas.length} threads with cpu > 0.05s`)

// kill only the spawned tree
const kids = t.map((r) => r.ProcessId).filter((p) => p !== child.pid)
child.kill("SIGKILL")
for (const k of kids) { try { process.kill(k, "SIGKILL") } catch {} }
await sleep(300)
process.exit(0)
