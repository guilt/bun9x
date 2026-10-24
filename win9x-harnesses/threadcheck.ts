import { spawn } from "child_process"
const dir = "D:\\WS\\OpenCode\\packages\\opencode\\dist\\opencode-windows-x86\\bin"
const child = spawn(dir + "\\opencode.exe", ["serve", "--port", "4317"], {
  cwd: dir, stdio: ["ignore", "pipe", "pipe"],
})
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
function run(cmd: string) {
  const ps = spawn("powershell", ["-NoProfile", "-Command", cmd], { stdio: ["ignore", "pipe", "pipe"] })
  return new Promise<string>((res) => { let o = ""; ps.stdout.on("data", (d) => o += d); ps.on("exit", () => res(o)) })
}
const snap = () => run(`$p = Get-Process -Id ${child.pid}; $p.Threads | ForEach-Object { "$($_.Id) $($_.TotalProcessorTime.TotalMilliseconds)" }`)
await sleep(12000)
const t1 = await snap()
await sleep(5000)
const t2 = await snap()
const parse = (s: string) => {
  const m = new Map<string, number>()
  for (const line of s.split("\n")) {
    const [id, ms] = line.trim().split(/\s+/)
    if (id && ms) m.set(id, parseFloat(ms))
  }
  return m
}
const A = parse(t1), B = parse(t2)
const deltas: Array<[string, number]> = []
for (const [tid, ms] of B) {
  const d = ms - (A.get(tid) ?? ms)
  if (d > 20) deltas.push([tid, d])
}
deltas.sort((x, y) => y[1] - x[1])
console.log("hot threads over 5s (tid, cpuMs):", deltas)
console.log("total threads:", B.size)
child.kill("SIGKILL")
process.exit(0)
