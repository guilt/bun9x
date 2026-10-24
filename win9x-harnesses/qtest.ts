import { spawn } from "child_process"
const ps = spawn("powershell", ["-NoProfile", "-Command",
  `Get-CimInstance Win32_Process -Filter "Name='opencode.exe'" | ForEach-Object { [PSCustomObject]@{ ProcessId = $_.ProcessId; ParentProcessId = $_.ParentProcessId; CPU = ($_.KernelModeTime + $_.UserModeTime)/1e7; WS = $_.WorkingSetSize } } | ConvertTo-Json -Compress`],
  { stdio: ["ignore", "pipe", "pipe"] })
let o = "", e = ""
ps.stdout!.on("data", (d) => o += d)
ps.stderr!.on("data", (d) => e += d)
ps.on("exit", (code) => {
  console.log("exit", code)
  console.log("stdout:", o.slice(0, 500))
  console.log("stderr:", e.slice(0, 500))
})
