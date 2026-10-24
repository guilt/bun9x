import { spawn } from "child_process"
const dir = "D:\\WS\\OpenCode\\packages\\opencode\\dist\\opencode-windows-x86\\bin"
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
function run(cmd: string) {
  const ps = spawn("powershell", ["-NoProfile", "-Command", cmd], { stdio: ["ignore", "pipe", "pipe"] })
  return new Promise<string>((res) => { let o = ""; ps.stdout.on("data", (d) => o += d); ps.on("exit", () => res(o)) })
}
const clean: Record<string, string | undefined> = {
  PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, WINDIR: process.env.WINDIR,
  TEMP: process.env.TEMP, TMP: process.env.TMP, USERPROFILE: process.env.USERPROFILE,
  APPDATA: process.env.APPDATA, LOCALAPPDATA: process.env.LOCALAPPDATA, COMSPEC: process.env.COMSPEC,
}
const child = spawn(dir + "\\opencode.exe", ["serve", "--port", "4317"], {
  cwd: dir, stdio: ["ignore", "pipe", "pipe"], env: clean,
})
await sleep(12000)
console.log("=== clean-env netstat ===")
console.log(await run(`netstat -ano | Select-String "${child.pid}"`))
console.log("=== raw IO counters ===")
console.log(await run(`$p = Get-Process -Id ${child.pid}; "readops=$($p.IOReadOperationCount) writeops=$($p.IOWriteOperationCount) readbytes=$($p.IOReadTransferCount) writebytes=$($p.IOWriteTransferCount) otherops=$($p.OtherOperationCount) otherbytes=$($p.OtherTransferCount)"`))
await sleep(5000)
console.log("=== raw IO counters 2 ===")
console.log(await run(`$p = Get-Process -Id ${child.pid}; "readops=$($p.IOReadOperationCount) writeops=$($p.IOWriteOperationCount) readbytes=$($p.IOReadTransferCount) writebytes=$($p.IOWriteTransferCount) otherops=$($p.OtherOperationCount) otherbytes=$($p.OtherTransferCount)"`))
child.kill("SIGKILL")
process.exit(0)
