import { spawn } from "child_process"
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function cpuMs(pid: number) {
  const ps = spawn("powershell", ["-NoProfile", "-Command", `(Get-Process -Id ${pid}).CPU`], { stdio: ["ignore", "pipe", "pipe"] })
  const out = await new Promise<string>((res) => { let o = ""; ps.stdout.on("data", (d) => o += d); ps.on("exit", () => res(o.trim())) })
  const v = parseFloat(out)
  return isNaN(v) ? -1 : v * 1000
}
async function measure(label: string, exe: string, code: string) {
  const child = spawn(exe, ["-e", code], { stdio: ["ignore", "pipe", "pipe"] })
  await sleep(3000)
  let prev = await cpuMs(child.pid!)
  let total = 0
  for (let i = 0; i < 4; i++) {
    await sleep(4000)
    const cpu = await cpuMs(child.pid!)
    total += cpu - prev
    prev = cpu
  }
  console.log(`${label}: avg ${(total / 4 / 4000 * 100).toFixed(1)}% of one core`)
  child.kill()
  await sleep(300)
}
const i586 = "D:\\WS\\Bun\\build\\release-i586\\bun.exe"
const modern = "C:\\Users\\Karthik\\.Bun\\bin\\bun.exe"
const nodeHttp = `import { createServer } from "node:http"; const s = createServer(); s.listen(4433, "127.0.0.1", () => console.log("up")); setInterval(() => {}, 1000);`
await measure("i586 node:http idle", i586, nodeHttp)
await measure("modern node:http idle", modern, nodeHttp)
const nodeHttpAny = `import { createServer } from "node:http"; const s = createServer(); s.listen(4434, () => console.log("up")); setInterval(() => {}, 1000);`
await measure("i586 node:http listen-any", i586, nodeHttpAny)
process.exit(0)
