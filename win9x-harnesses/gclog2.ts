import { spawn } from "child_process"
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs"
const dir = "D:\\WS\\OpenCode\\packages\\opencode\\dist\\opencode-windows-x86\\bin"
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function run(label: string, env: Record<string, string | undefined>) {
  const errFile = `C:\\Users\\Karthik\\AppData\\Local\\Temp\\opencode\\gclog-${label}.txt`
  try { if (existsSync(errFile)) unlinkSync(errFile) } catch {}
  // cmd file redirection (p49 pattern — no pipes)
  const child = spawn("cmd", ["/c", `"${dir}\\opencode.exe" serve --port 4317 2> "${errFile}"`], {
    cwd: dir, stdio: ["ignore", "ignore", "ignore"], env,
  })
  await sleep(25000)
  child.kill("SIGKILL")
  await sleep(300)
  const text = existsSync(errFile) ? readFileSync(errFile, "utf8") : ""
  const lines = text.split("\n").filter((l) => l.includes("GC") || l.includes("alloc"))
  const requesting = lines.filter((l) => l.includes("Requesting GC"))
  const cycles = lines.filter((l) => /gc cycle|Collecting|full GC|completed/i.test(l))
  console.log(`=== ${label}: total GC-ish lines=${lines.length} requesting=${requesting.length} cycles≈${cycles.length}`)
  for (const l of requesting.slice(0, 6)) console.log("  ", l.trim().slice(0, 200))
  for (const l of cycles.slice(0, 6)) console.log("  ", l.trim().slice(0, 200))
  if (lines.length === 0) console.log("  (no GC lines; err file size", text.length, ")")
}
const base: Record<string, string | undefined> = {
  PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, WINDIR: process.env.WINDIR,
  TEMP: process.env.TEMP, TMP: process.env.TMP, USERPROFILE: process.env.USERPROFILE,
  APPDATA: process.env.APPDATA, LOCALAPPDATA: process.env.LOCALAPPDATA, COMSPEC: process.env.COMSPEC,
}
await run("stage1", { ...base, OPENCODE_BURN_STAGE: "1", JSC_logGC: "1" })
await run("full", { ...base, JSC_logGC: "1" })
process.exit(0)
