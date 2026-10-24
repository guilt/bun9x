import { spawn } from "child_process"
const exe = "D:\\WS\\OpenCode\\packages\\opencode\\dist\\opencode-windows-x86\\bin\\opencode.exe"
const stage = process.argv[2] ?? "2"
const child = spawn(exe, ["serve", "--port", "4323"], {
  cwd: "D:\\WS\\OpenCode\\packages\\opencode\\dist\\opencode-windows-x86\\bin",
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, JSC_logGC: "1", OPENCODE_BURN_STAGE: stage },
})
let out = ""
child.stdout!.on("data", (d) => { out += String(d) })
child.stderr!.on("data", () => {})
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function tree(root: number) {
  const ps = spawn("powershell", ["-NoProfile", "-Command",
    `Get-CimInstance Win32_Process -Filter "Name='opencode.exe' or Name='cmd.exe'" | ForEach-Object { [PSCustomObject]@{ ProcessId = $_.ProcessId; ParentProcessId = $_.ParentProcessId; CPU = ($_.KernelModeTime + $_.UserModeTime)/1e7 } } | ConvertTo-Json -Compress`],
    { stdio: ["ignore", "pipe", "pipe"] })
  const o = await new Promise<string>((res) => { let s = ""; ps.stdout!.on("data", (d) => s += d); ps.on("exit", () => res(s)) })
  let rows: Array<{ ProcessId: number; ParentProcessId: number; CPU: number }> = []
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

await sleep(30000)
console.log("out:", out.trim().split("\n").slice(0, 3).join(" | "))
const b = await tree(child.pid!)
console.log("tree pids:", JSON.stringify(b.map((r) => r.ProcessId)))
await sleep(10000)
const a = await tree(child.pid!)
let total = 0
for (const x of a) {
  const y = b.find((z) => z.ProcessId === x.ProcessId)
  if (y) total += x.CPU - y.CPU
}
console.log(`WIN11 stage2 TREE CPU: ${total.toFixed(2)}s over 10s = ${(total / 10 * 100).toFixed(1)}%`)
child.kill("SIGKILL")
for (const x of a) { try { process.kill(x.ProcessId, "SIGKILL") } catch {} }
await sleep(300)
process.exit(0)
