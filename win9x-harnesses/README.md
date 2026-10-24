# win9x harnesses

Diagnostic scripts used while bringing up the i586 Windows XP build of
Bun/OpenCode/OpenTUI. They are archived here so the investigation can be resumed
(and extended) later. They are **not** part of the build or test suite.

Most scripts hardcode paths from the development machine
(`D:\WS\OpenCode\...`, `C:\Users\Karthik\AppData\Local\Temp\opencode\...`).
Adjust the constants at the top before running elsewhere.

## Running

Most `.ts` harnesses are Bun scripts that spawn a built `opencode.exe` and watch
its stderr/CPU:

```sh
bun win9x-harnesses/fixcheck.ts
# or with the i586 runtime:
D:\WS\Bun\build\release-i586\bun.exe win9x-harnesses\fixcheck.ts
```

They expect `packages/opencode/dist/opencode-windows-x86/bin/opencode.exe` to
exist (see OpenCode's `BUILD_WIN9X.md`).

## Environment knobs used

| Variable | Effect |
| --- | --- |
| `JSC_logGC=1` | JSC GC logging (0 none, 1 basic, 2 verbose) |
| `JSC_{large,medium,small,miniVM}HeapGrowthFactor=2` | Raise GC growth factors (the shipped respawn sets these) |
| `OPENCODE_JSC_GC_FIXED=1` | Skip the OpenCode startup respawn banner |
| `BUN_GC_TIMER_DISABLE=1`, `BUN_GC_TIMER_INTERVAL` | Disable/override the 1 s `GarbageCollectionController` tick |
| `OPENCODE_BURN_STAGE=0/1/2` | Park startup at a known point (requires the debug gates; not in the shipped binary) |
| `OPENCODE_BOOT_TRACE=1` | TUI/worker phase timestamps on stderr |
| `OPENCODE_FETCH_TRACE` | fetch tracing (debug builds) |
| `BUN_INSPECT` | Attach the inspector (also disables the respawn) |

## Index

### GC storm / idle burn

- `stormwatch.ts` - stage-2 + `BUN_GC_TIMER_DISABLE` storm repro; logs FullCollection
  rate and process exit.
- `fixcheck.ts` - spawns `serve`, checks `/doc`, steady GC counts and CPU, and kills
  the re-exec tree (including `cmd.exe`).
- `gccount.ts`, `gclog2.ts`, `gclog3.ts`, `gclog4.ts` - GC log line counters/variants.
- `spiraltest.ts`, `spiraln.ts` - minimal allocation-spiral repros.
- `trackalloc.ts`, `heapprof.ts` - allocation/heap accounting.
- `parseheap.ts`, `parseheap2.ts`, `parseheap3.ts`, `parseheap4.ts`, `parseprof.ts` -
  JSC heap/GC log parsers.
- `winstage2.ts`, `burnstage.ts`, `burnphase.ts`, `gcenv.ts`, `gcexe.ts` - stage-gating
  drivers and env probes.

### CPU / thread attribution

- `threads.ts` - per-thread CPU via .NET `Process.Threads` (`Win32_Thread` returns
  hollow rows on XP).
- `jsthread.ts`, `threadcheck.ts` - JS-thread isolation.
- `bootprof.ts`, `fxprof.ts`, `fxprof2.ts`, `cdpprof.ts`, `srcprof.ts`, `profsrc.ps1` -
  startup/CPU attribution. Some rely on the removed `__bootProf`/`__fxProf` wrapper
  banner and need that instrumentation re-added to a debug build.
- `insptest.ts`, `profileinspect.ts`, `profexit.ts`, `preload-exit.ts` -
  inspector/profiler entry points.

### Runtime probes

- `i586serve.ts`, `i586src.ts`, `nodehttp.ts`, `netcheck.ts` - i586 server, HTTP and
  network checks.
- `iocheck.ts`, `iocheck2.ts`, `modcheck.ts`, `logcheck.ts` - io/module/log probes.
- `qtest.ts`, `envtest.ts`, `diffsnap.ts`, `wrap.ts`, `effectmin.ts`, `effectmin2.ts` -
  timers, env passthrough, snapshots, global wrapping, minimal Effect apps.
- `patchprobe.ts`, `patchprobe2.ts`, `patchprobe3.ts`, `patchprobe4.ts` - verification
  probes for the Bun/XP patches.

### Binary / packaging checks

- `scan.js` - confirms a DLL byte chunk is embedded in the compiled exe.
- `scan2.js` - checks for banner/profiler marker strings in the exe.
- `ab.ps1` - A/B a DLL against `serve` (CPU sampling + `/doc`).
- `tui-trace.bat` - XP wrapper that runs the TUI with `OPENCODE_BOOT_TRACE=1` and
  appends stderr to `boot-trace.log`.

## Adding harnesses

- Keep them in this directory and name them for what they measure
  (`<area>-<probe>.ts`).
- Note the target build, env vars, and expected output at the top of the file.
- Do not commit secrets, cookies, or credentials; local paths and PIDs are fine.
- XP-side helpers (bat + ps1) live on the test box under `D:\WS\OpenCode-Test`
  and were removed once validated. Recreate them as needed: sample CPU with
  `Win32_Process` (`Win32_Thread` is broken on XP), copy logs with `scp -O`, and
  never kill by image name.
