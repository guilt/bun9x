import { spawn } from "child_process"
const dir = "D:\\WS\\OpenCode\\packages\\opencode\\dist\\opencode-windows-x86\\bin"
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function run(label: string, env: Record<string, string | undefined>) {
  const child = spawn(dir + "\\opencode.exe", ["serve", "--port", "4317"], {
    cwd: dir, stdio: ["ignore", "ignore", "pipe"], env,
  })
  let err = ""
  child.stderr!.on("data", (d) => { err += String(d) })
  await sleep(25000)
  child.kill("SIGKILL")
  await sleep(300)
  const lines = err.split("\n").filter((l) => l.includes("GC") || l.includes("alloc"))
  console.log(`=== ${label}: stderr bytes=${err.length} GC-ish lines=${lines.length}`)
  for (const l of lines.slice(0, 12)) console.log("  ", l.trim().slice(0, 220))
}
const base: Record<string, string | undefined> = {
  PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, WINDIR: process.env.WINDIR,
  TEMP: process.env.TEMP, TMP: process.env.TMP, USERPROFILE: process.env.USERPROFILE,
  APPDATA: process.env.APPDATA, LOCALAPPDATA: process.env.LOCALAPPDATA, COMSPEC: process.env.COMSPEC,
}
await run("full+logGC", { ...base, JSC_logGC: "1" })
process.exit(0)
