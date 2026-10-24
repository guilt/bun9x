import { spawn } from "child_process"
const dir = "D:\\WS\\OpenCode\\packages\\opencode\\dist\\opencode-windows-x86\\bin"
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function cpuMs(pid: number) {
  const ps = spawn("powershell", ["-NoProfile", "-Command", `(Get-Process -Id ${pid}).CPU`], { stdio: ["ignore", "pipe", "pipe"] })
  const out = await new Promise<string>((res) => { let o = ""; ps.stdout.on("data", (d) => o += d); ps.on("exit", () => res(o.trim())) })
  const v = parseFloat(out)
  return isNaN(v) ? -1 : v * 1000
}
async function measure(label: string, env: Record<string, string | undefined>, args: string[]) {
  const child = spawn(dir + "\\opencode.exe", args, {
    cwd: dir, stdio: ["ignore", "pipe", "pipe"], env: { ...env },
  })
  let out = ""
  child.stdout!.on("data", (d) => { out += String(d) })
  await sleep(6000)
  let prev = await cpuMs(child.pid!)
  let total = 0
  for (let i = 0; i < 4; i++) {
    await sleep(4000)
    const cpu = await cpuMs(child.pid!)
    total += cpu - prev
    prev = cpu
  }
  console.log(`${label}: avg ${(total / 4 / 4000 * 100).toFixed(1)}% of one core | out: ${out.trim().slice(0, 120)}`)
  child.kill("SIGKILL")
  await sleep(400)
}
const base: Record<string, string | undefined> = {
  PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, WINDIR: process.env.WINDIR,
  TEMP: process.env.TEMP, TMP: process.env.TMP, USERPROFILE: process.env.USERPROFILE,
  APPDATA: process.env.APPDATA, LOCALAPPDATA: process.env.LOCALAPPDATA, COMSPEC: process.env.COMSPEC,
}
await measure("stage1 idle-before-server", { ...base, OPENCODE_BURN_STAGE: "1" }, ["serve", "--port", "4317"])
await measure("stage0 full-serve (control)", base, ["serve", "--port", "4317"])
process.exit(0)
