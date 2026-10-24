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
await sleep(12000) // deep into steady burn
console.log("=== netstat for pid", child.pid, "===")
console.log(await run(`netstat -ano | Select-String "${child.pid}"`))
console.log("=== child processes ===")
console.log(await run(`Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq ${child.pid} } | Select-Object ProcessId, Name, CommandLine | Format-List`))
console.log("=== opencode env (filtered) ===")
console.log(await run(`Get-ChildItem Env: | Where-Object { $_.Name -match 'OPENCODE|BUN' } | Format-Table -AutoSize`))
child.kill("SIGKILL")
process.exit(0)
