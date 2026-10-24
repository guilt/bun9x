import { spawn } from "child_process"
const exe = "D:\\WS\\OpenCode\\packages\\opencode\\dist\\opencode-windows-x86\\bin\\opencode.exe"
const errPath = "C:\\Users\\Karthik\\AppData\\Local\\Temp\\opencode\\storm-watch.err"
const child = spawn(exe, ["serve", "--port", "4329"], {
  cwd: "D:\\WS\\OpenCode\\packages\\opencode\\dist\\opencode-windows-x86\\bin",
  stdio: ["ignore", "ignore", "pipe"],
  env: { ...process.env, JSC_logGC: "1", OPENCODE_BURN_STAGE: "2", BUN_GC_TIMER_DISABLE: "1" },
})
const errFile = Bun.file(errPath)
let stderr = ""
child.stderr!.on("data", (d) => { stderr += String(d) })
child.on("exit", (code, sig) => console.log(`EXIT code=${code} sig=${sig} at=${Date.now() - t0}ms`))
const t0 = Date.now()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function countEnds(s: string) {
  let n = 0, i = 0
  while ((i = s.indexOf("GC END!", i)) >= 0) { n++; i += 7 }
  return n
}
let lastEnds = 0
for (let round = 1; round <= 18; round++) {
  await sleep(5000)
  const ends = countEnds(stderr)
  const delta = ends - lastEnds
  lastEnds = ends
  const crashed = stderr.includes("Bun has crashed")
  console.log(`t=${((Date.now() - t0) / 1000).toFixed(0)}s ends=${ends} (+${delta}/5s) crashed=${crashed} errLen=${stderr.length}`)
  if (crashed) break
}
try { process.kill(child.pid!, "SIGKILL") } catch {}
for (const line of (stderr.match(/N<panic[^\n]*/) || [])) console.log("PANIC:", line)
const idx = stderr.indexOf("Elapsed:")
if (idx >= 0) console.log("CRASHINFO:", stderr.substring(idx, idx + 220).replace(/\n/g, " | "))
process.exit(0)
