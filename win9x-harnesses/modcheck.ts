import { spawn } from "child_process"
const dir = "D:\\WS\\OpenCode\\packages\\opencode\\dist\\opencode-windows-x86\\bin"
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
function run(cmd: string) {
  const ps = spawn("powershell", ["-NoProfile", "-Command", cmd], { stdio: ["ignore", "pipe", "pipe"] })
  return new Promise<string>((res) => { let o = ""; ps.stdout.on("data", (d) => o += d); ps.on("exit", () => res(o)) })
}
const opencode = spawn(dir + "\\opencode.exe", ["serve", "--port", "4317"], { cwd: dir, stdio: ["ignore", "pipe", "pipe"] })
const minimal = spawn("D:\\WS\\Bun\\build\\release-i586\\bun.exe", ["-e", "Bun.serve({port:4455, fetch(){return new Response('ok')}}); setInterval(()=>{},1000)"], { stdio: ["ignore", "pipe", "pipe"] })
await sleep(12000)
const mods = async (pid: number) => {
  const out = await run(`$p = Get-Process -Id ${pid}; [System.Text.StringBuilder]::new(($p.Modules | ForEach-Object { $_.ModuleName }) -join [Environment]::NewLine).ToString()`)
  return new Set(out.split("\n").map((s) => s.trim().toLowerCase()).filter(Boolean))
}
const A = await mods(opencode.pid!)
const B = await mods(minimal.pid!)
const onlyA = [...A].filter((m) => !B.has(m)).sort()
const onlyB = [...B].filter((m) => !A.has(m)).sort()
console.log("=== loaded ONLY in opencode ===")
for (const m of onlyA) console.log(m)
console.log("=== loaded ONLY in minimal-bun ===")
for (const m of onlyB) console.log(m)
console.log("opencode modules:", A.size, "minimal:", B.size)
opencode.kill("SIGKILL"); minimal.kill()
process.exit(0)
