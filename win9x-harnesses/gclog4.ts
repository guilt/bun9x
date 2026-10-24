import { spawn } from "child_process"
const dir = "D:\\WS\\OpenCode\\packages\\opencode\\dist\\opencode-windows-x86\\bin"
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const child = spawn(dir + "\\opencode.exe", ["serve", "--port", "4317"], {
  cwd: dir, stdio: ["ignore", "ignore", "pipe"],
  env: { ...process.env, JSC_logGC: "1", OPENCODE_BURN_STAGE: "1" },
})
let err = ""
child.stderr!.on("data", (d) => { err += String(d) })
await sleep(25000)
child.kill("SIGKILL")
const lines = err.split("\n").filter((l) => l.includes("GC") || l.includes("alloc"))
const req = lines.filter((l) => l.includes("Requesting"))
console.log(`stage1: stderr bytes=${err.length} GC-ish=${lines.length} requesting=${req.length}`)
for (const l of req.slice(0, 8)) console.log("  ", l.trim().slice(0, 220))
process.exit(0)
