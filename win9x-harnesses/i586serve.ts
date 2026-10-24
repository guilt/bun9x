import { spawn } from "child_process"
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function cpuMs(pid: number) {
  const ps = spawn("powershell", ["-NoProfile", "-Command", `(Get-Process -Id ${pid}).CPU`], { stdio: ["ignore", "pipe", "pipe"] })
  const out = await new Promise<string>((res) => { let o = ""; ps.stdout.on("data", (d) => o += d); ps.on("exit", () => res(o.trim())) })
  const v = parseFloat(out)
  return isNaN(v) ? -1 : v * 1000
}
async function measure(label: string, exe: string, args: string[]) {
  const child = spawn(exe, args, { stdio: ["ignore", "pipe", "pipe"] })
  await sleep(3000) // let it start
  let prev = await cpuMs(child.pid!)
  let total = 0
  for (let i = 0; i < 5; i++) {
    await sleep(4000)
    const cpu = await cpuMs(child.pid!)
    total += cpu - prev
    prev = cpu
  }
  child.kill()
  console.log(`${label}: avg ${(total / 5 / 4000 * 100).toFixed(1)}% of one core (total ${total.toFixed(0)}ms over 20s)`)
}
const i586 = "D:\\WS\\Bun\\build\\release-i586\\bun.exe"
const modern = "C:\\Users\\Karthik\\.Bun\\bin\\bun.exe"
await measure("i586 idle script", i586, ["-e", "setInterval(() => {}, 1000)"])
await measure("i586 minimal Bun.serve", i586, ["-e", "Bun.serve({ port: 4411, fetch() { return new Response('ok') } }); setInterval(() => {}, 1000)"])
await measure("modern minimal Bun.serve", modern, ["-e", "Bun.serve({ port: 4412, fetch() { return new Response('ok') } }); setInterval(() => {}, 1000)"])
process.exit(0)
