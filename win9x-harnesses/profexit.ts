// In-process serve harness for CPU profiling: bun's --cpu-prof writes on clean exit.
process.env.OPENCODE_PRINT_LOGS ??= "0"
const { parseArgs } = await import("@oclif/core/lib/parser")
// We'll just import the serve command's run and let bun handle argv.
process.argv = [process.argv[0], process.argv[1], "serve", "--port", "4471"]
const start = Date.now()
const mod = await import("./src/index.ts")
// If index's main didn't run (bun import of TS entry may auto-run), we drive it manually:
// @ts-expect-error — top-level main may not be exported
if (typeof mod.default?.run === "function") {
  await mod.default.run(["serve", "--port", "4471"])
} else {
  // Fallback: assume argv-driven main already started via side effect; keep alive.
  console.error("main not exported; keeping process alive for profile")
}
setInterval(() => {
  if (Date.now() - start > 25000) {
    console.error("exiting for cpu profile flush")
    process.exit(0)
  }
}, 1000)
