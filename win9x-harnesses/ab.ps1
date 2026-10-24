param([string]$Dll, [int]$Port, [string]$Label)
$dst = 'D:\WS\OpenCode\node_modules\.bun\@opentui+core-win32-x86@..+opentui+dist-tarballs+opentui-core-win32-x86-511.tgz\node_modules\@opentui\core-win32-x86\opentui.dll'
Copy-Item -LiteralPath $Dll -Destination $dst -Force
$out = "C:\Users\Karthik\AppData\Local\Temp\opencode\$Label.out"
$err = "C:\Users\Karthik\AppData\Local\Temp\opencode\$Label.err"
Remove-Item $out, $err -ErrorAction SilentlyContinue
$p = Start-Process -FilePath 'D:\WS\OpenCode\packages\opencode\dist\opencode-windows-x86\bin\opencode.exe' -ArgumentList @('serve','--port',"$Port") -PassThru -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err
Start-Sleep 8
$kids = Get-CimInstance Win32_Process -Filter "Name='opencode.exe'" | Where-Object { $_.CommandLine -like "*--port $Port*" }
$serve = $kids | Where-Object { $_.CommandLine -notlike '*.exe  serve*' -or $true } | Select-Object -First 1
if (-not $serve) { $serve = $kids | Select-Object -First 1 }
$spid = if ($serve) { $serve.ProcessId } else { $p.Id }
$c1 = (Get-Process -Id $spid -EA SilentlyContinue).CPU
$r1 = curl.exe -sS --noproxy '*' -m 6 -o NUL -w "code=%{http_code} t=%{time_total}" "http://127.0.0.1:$Port/doc" 2>&1
Start-Sleep 12
$c2 = (Get-Process -Id $spid -EA SilentlyContinue).CPU
$r2 = curl.exe -sS --noproxy '*' -m 6 -o NUL -w "code=%{http_code} t=%{time_total}" "http://127.0.0.1:$Port/doc" 2>&1
$alive = -not (Get-Process -Id $spid -EA SilentlyContinue).HasExited
$mods = (Get-Process -Id $spid -EA SilentlyContinue).Modules | Where-Object { $_.ModuleName -like '*opentui*' } | Select-Object -ExpandProperty FileName
"[$Label] pid=$spid alive=$alive cpu_t8=$c1 cpu_t20=$c2 doc1=[$r1] doc2=[$r2]"
"[$Label] dll_loaded=$mods"
$errlines = Get-Content $err -EA SilentlyContinue
if ($errlines) { "[$Label] stderr:"; $errlines | Select-Object -First 8 }
Get-CimInstance Win32_Process -Filter "Name='opencode.exe'" | Where-Object { $_.CommandLine -like "*--port $Port*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -EA SilentlyContinue }
if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force -EA SilentlyContinue }
Start-Sleep 2
