// Preloaded by bun: force clean exit after 25s so --cpu-prof flushes.
setTimeout(() => {
  console.error("[preload] exiting for cpu-prof flush")
  process.exit(0)
}, 25000)
