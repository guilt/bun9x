import { spawn } from "child_process"
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function cpuMs(pid: number) {
  const ps = spawn("powershell", ["-NoProfile", "-Command", `(Get-Process -Id ${pid}).CPU`], { stdio: ["ignore", "pipe", "pipe"] })
  const out = await new Promise<string>((res) => { let o = ""; ps.stdout.on("data", (d) => o += d); ps.on("exit", () => res(o.trim())) })
  const v = parseFloat(out)
  return isNaN(v) ? -1 : v * 1000
}
const child = spawn("D:\\WS\\Bun\\build\\release-i586\\bun.exe", ["src/index.ts", "serve", "--port", "4474"], {
  cwd: "D:\\WS\\OpenCode\\packages\\opencode", stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, JSC_logGC: "1" },
})
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
console.log(`i586 source-run burn: avg ${(total / 5 / 4000 * 100).toFixed(1)}% of one core`)
const req = err.split("\n").filter((l) => l.includes("Requesting GC"))
const ends = err.split("\n").filter((l) => l.includes("GC END"))
console.log(`requesting GCs: ${req.length}, gc ends: ${ends.length} (~33s)`)
for (const l of req.slice(0, 5)) console.log("  ", l.trim().slice(0, 180))
child.kill("SIGKILL")
process.exit(0)
