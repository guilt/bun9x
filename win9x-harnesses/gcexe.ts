import { spawn } from "child_process"
// Test compiled i586 exe with optional JSC_* env args, measure steady CPU + GC counts.
const args = process.argv.slice(2)
const extraEnv: Record<string, string> = {}
const entryArgs: string[] = []
for (const a of args) {
  const eq = a.indexOf("=")
  if (a.startsWith("JSC_") && eq > 0) extraEnv[a.slice(0, eq)] = a.slice(eq + 1)
  else entryArgs.push(a)
}
const exe = "D:\\WS\\OpenCode\\packages\\opencode\\dist\\opencode-windows-x86\\bin\\opencode.exe"
const child = spawn(exe, entryArgs.length ? entryArgs : ["serve", "--port", "4317"], {
  cwd: "D:\\WS\\OpenCode\\packages\\opencode\\dist\\opencode-windows-x86\\bin",
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, JSC_logGC: "1", ...extraEnv },
})
let err = ""
child.stderr!.on("data", (d) => { err += String(d) })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function cpuMs(pid: number) {
  const ps = spawn("powershell", ["-NoProfile", "-Command", `(Get-Process -Id ${pid}).CPU`], { stdio: ["ignore", "pipe", "pipe"] })
  const out = await new Promise<string>((res) => { let o = ""; ps.stdout.on("data", (d) => o += d); ps.on("exit", () => res(o.trim())) })
  const v = parseFloat(out)
  return isNaN(v) ? -1 : v * 1000
}
await sleep(8000)
const pid = child.pid!
let prev = await cpuMs(pid)
let total = 0
for (let i = 0; i < 5; i++) {
  await sleep(4000)
  const c = await cpuMs(pid)
  total += c - prev
  prev = c
}
child.kill("SIGKILL")
const req = err.split("\n").filter((l) => l.includes("Requesting GC")).length
const ends = err.split("\n").filter((l) => l.includes("GC END")).length
const envStr = Object.entries(extraEnv).map(([k, v]) => `${k}=${v}`).join(" ") || "(none)"
console.log(`compiled [${envStr}]: requesting=${req} ends=${ends} steadyCPU=${(total / 5 / 4000 * 100).toFixed(1)}%`)
process.exit(0)
