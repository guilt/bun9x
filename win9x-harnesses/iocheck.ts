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
await sleep(12000)
const name = (await run(`(Get-Process -Id ${child.pid}).ProcessName`)).trim()
console.log("process:", name, "pid", child.pid)
const s1 = await run(`$p = Get-Process -Id ${child.pid}; "$($p.IOReadOperationCount) $($p.IOWriteOperationCount) $($p.IOReadTransferCount) $($p.IOWriteTransferCount) $($p.OtherOperationCount)"`)
await sleep(5000)
const s2 = await run(`$p = Get-Process -Id ${child.pid}; "$($p.IOReadOperationCount) $($p.IOWriteOperationCount) $($p.IOReadTransferCount) $($p.IOWriteTransferCount) $($p.OtherOperationCount)"`)
const parse = (s: string) => s.trim().split(/\s+/).map(Number)
const A = parse(s1), B = parse(s2)
console.log("over 5s: readOps/s:", ((B[0] - A[0]) / 5).toFixed(0), "writeOps/s:", ((B[1] - A[1]) / 5).toFixed(0), "readBytes/s:", ((B[2] - A[2]) / 5).toFixed(0), "writeBytes/s:", ((B[3] - A[3]) / 5).toFixed(0), "otherOps/s:", ((B[4] - A[4]) / 5).toFixed(0))
child.kill("SIGKILL")
process.exit(0)
