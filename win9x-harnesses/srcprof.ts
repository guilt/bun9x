import { spawn } from "child_process"
import { mkdirSync } from "fs"
const profDir = "C:\\Users\\Karthik\\AppData\\Local\\Temp\\opencode\\prof"
mkdirSync(profDir, { recursive: true })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function cpuMs(pid: number) {
  const ps = spawn("powershell", ["-NoProfile", "-Command", `(Get-Process -Id ${pid}).CPU`], { stdio: ["ignore", "pipe", "pipe"] })
  const out = await new Promise<string>((res) => { let o = ""; ps.stdout.on("data", (d) => o += d); ps.on("exit", () => res(o.trim())) })
  const v = parseFloat(out)
  return isNaN(v) ? -1 : v * 1000
}
const child = spawn("C:\\Users\\Karthik\\.Bun\\bin\\bun.exe", [
  "--cpu-prof",
  "--cpu-prof-dir", profDir,
  "src/index.ts", "serve", "--port", "4466",
], { cwd: "D:\\WS\\OpenCode\\packages\\opencode", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, JSC_logGC: "1" } })
let err = ""
child.stderr!.on("data", (d) => { err += String(d) })
await sleep(8000)
let prev = await cpuMs(child.pid!)
let total = 0
for (let i = 0; i < 5; i++) {
  await sleep(4000)
  const cpu = await cpuMs(child.pid!)
  total += cpu - prev
  prev = cpu
}
console.log(`source-run burn: avg ${(total / 5 / 4000 * 100).toFixed(1)}% of one core`)
const gcLines = err.split("\n").filter((l) => l.includes("Requesting GC"))
console.log("requesting GCs in ~28s:", gcLines.length)
for (const l of gcLines.slice(0, 4)) console.log("  ", l.trim().slice(0, 180))
child.kill("SIGKILL")
await sleep(500)
process.exit(0)
