import { spawn } from "child_process"

const bun = "D:\\WS\\Bun\\build\\release-i586\\bun.exe"
const wd = "D:\\WS\\OpenCode\\packages\\opencode"

const child = spawn(
  bun,
  ["src/index.ts", "serve", "--port", "4313"],
  { cwd: wd, stdio: ["ignore", "pipe", "pipe"] },
)

child.stdout.on("data", (d) => process.stdout.write(d))
child.stderr.on("data", (d) => process.stderr.write(d))

child.on("exit", (code, sig) => {
  console.log(`[wrapper] child exited code=${code} sig=${sig}`)
})

// Wait ~40s of steady-state CPU burn, then kill the child and exit cleanly
// so this parent process flushes its own --cpu-prof profile to disk.
setTimeout(() => {
  console.log("[wrapper] killing child, then exiting to flush profile")
  try { child.kill("SIGKILL") } catch {}
  setTimeout(() => process.exit(0), 1500)
}, 40000)
