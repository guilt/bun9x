import { spawn } from "child_process"
import { spawn as psSpawn } from "child_process"
const dir = "D:\\WS\\OpenCode\\packages\\opencode\\dist\\opencode-windows-x86\\bin"
const child = spawn(dir + "\\opencode.exe", ["serve", "--port", "4317"], {
  cwd: dir, stdio: ["ignore", "pipe", "pipe"],
})
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function cpuMs() {
  const ps = psSpawn("powershell", ["-NoProfile", "-Command", `(Get-Process -Id ${child.pid}).CPU`], { stdio: ["ignore", "pipe", "pipe"] })
  const out = await new Promise<string>((res) => { let o = ""; ps.stdout.on("data", (d) => o += d); ps.on("exit", () => res(o.trim())) })
  const v = parseFloat(out)
  return isNaN(v) ? -1 : v * 1000
}
// sample CPU every 2s from spawn to t=30s, mark server-up time by reading stdout banner
let serverUpAt = -1
let out = ""
child.stdout!.on("data", (d) => {
  out += String(d)
  if (serverUpAt < 0 && /listening/i.test(out)) serverUpAt = Date.now() - t0
})
const t0 = Date.now()
let prev = await cpuMs()
console.log("t=0 cpu:", prev)
for (let i = 1; i <= 15; i++) {
  await sleep(2000)
  const cpu = await cpuMs()
  const t = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`t=${t}s cpuDelta=${(cpu - prev).toFixed(0)}ms${serverUpAt >= 0 && Date.now() - t0 >= serverUpAt ? " [server up]" : ""}`)
  prev = cpu
}
child.kill("SIGKILL")
process.exit(0)
