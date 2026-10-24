import { spawn } from "child_process"
const args = process.argv.slice(2)
const entry = args[0]
const extra = args.slice(1)
const child = spawn("D:\\WS\\Bun\\build\\release-i586\\bun.exe", [entry, ...extra], {
  cwd: "D:\\WS\\OpenCode\\packages\\opencode", stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, JSC_logGC: "1" },
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
await sleep(3000)
const pid = child.pid!
let prev = await cpuMs(pid)
let total = 0
for (let i = 0; i < 4; i++) {
  await sleep(4000)
  const c = await cpuMs(pid)
  total += c - prev
  prev = c
}
child.kill("SIGKILL")
const req = err.split("\n").filter((l) => l.includes("Requesting GC")).length
const ends = err.split("\n").filter((l) => l.includes("GC END")).length
console.log(`${entry} ${extra.join(" ")}: requesting=${req} ends=${ends} idleCPU=${(total / 4 / 4000 * 100).toFixed(1)}%`)
process.exit(0)
