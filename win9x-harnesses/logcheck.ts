import { spawn } from "child_process"
const dir = "D:\\WS\\OpenCode\\packages\\opencode\\dist\\opencode-windows-x86\\bin"
const logFile = "C:\\Users\\Karthik\\.local\\share\\opencode\\log\\opencode.log"
import { statSync, openSync, readSync, closeSync } from "fs"
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const child = spawn(dir + "\\opencode.exe", ["serve", "--port", "4317"], { cwd: dir, stdio: ["ignore", "pipe", "pipe"] })
await sleep(3000)
const sizeBefore = statSync(logFile).size
await sleep(15000)
const sizeAfter = statSync(logFile).size
console.log(`log grew ${(sizeAfter - sizeBefore)} bytes over ~12s (${Math.round((sizeAfter - sizeBefore) / 12)} B/s)`)
// tail the new content
const len = sizeAfter - sizeBefore
if (len > 0 && len < 500000) {
  const fd = openSync(logFile, "r")
  const buf = Buffer.alloc(Math.min(len, 4000))
  readSync(fd, buf, 0, buf.length, sizeBefore)
  closeSync(fd)
  console.log("--- tail of new content (first 2000 chars) ---")
  console.log(buf.toString("utf8").slice(0, 2000))
}
child.kill("SIGKILL")
process.exit(0)
