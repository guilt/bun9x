$wd = "D:\WS\OpenCode\packages\opencode"
$bun = "D:\WS\Bun\build\release-i586\bun.exe"
$out = Join-Path $wd "so.txt"
$err = Join-Path $wd "se.txt"
Remove-Item (Join-Path $wd "*.cpuprofile"), (Join-Path $wd "prof-src.md"), $out, $err -ErrorAction SilentlyContinue

$p = Start-Process -FilePath $bun -ArgumentList @(
  "--cpu-prof", "--cpu-prof-md", "--cpu-prof-name", "prof-src.md",
  "--cpu-prof-dir", "`"$wd`"",
  "src/index.ts", "serve", "--port", "4313"
) -PassThru -WindowStyle Hidden -WorkingDirectory $wd `
  -RedirectStandardOutput $out -RedirectStandardError $err

"started pid=$($p.Id)"
$deadline = (Get-Date).AddSeconds(60)
$ready = $false
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 500
  if (Test-Path $out) {
    if (Select-String -Path $out -Pattern "listening" -Quiet) { $ready = $true; break }
  }
  if ($p.HasExited) { "exited early code=$($p.ExitCode)"; break }
}
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WinC {
  [DllImport("kernel32.dll")] public static extern bool AllocConsole();
  [DllImport("kernel32.dll")] public static extern bool AttachConsole(int pid);
  [DllImport("kernel32.dll")] public static extern bool SetConsoleCtrlHandler(IntPtr h, bool add);
  [DllImport("kernel32.dll")] public static extern bool GenerateConsoleCtrlEvent(uint evt, uint group);
}
"@
if ($ready) {
  "LISTENING - profiling for 30s"
  Start-Sleep -Seconds 30
  "sending Ctrl+C to opencode"
  [WinC]::SetConsoleCtrlHandler([IntPtr]::Zero, $true) | Out-Null
  [WinC]::AttachConsole($p.Id) | Out-Null
  [WinC]::GenerateConsoleCtrlEvent(0, 0) | Out-Null
  $w2 = (Get-Date).AddSeconds(15)
  while ((Get-Date) -lt $w2 -and -not $p.HasExited) { Start-Sleep -Milliseconds 500 }
  if (-not $p.HasExited) { "still alive after Ctrl+C, forcing"; & taskkill /F /PID $p.Id }
} else {
  "never saw listening; killing"
  & taskkill /F /PID $p.Id 2>$null
}
Start-Sleep -Seconds 3
"err tail:"; Get-Content $err -Tail 8 -ErrorAction SilentlyContinue
"profile files:"
Get-ChildItem $wd -Filter "*.cpuprofile" -ErrorAction SilentlyContinue | Select-Object Name, Length
Get-ChildItem $wd -Filter "prof-src.md" -ErrorAction SilentlyContinue | Select-Object Name, Length
