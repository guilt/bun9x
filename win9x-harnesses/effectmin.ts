// Minimal Effect + batched file logger + Effect.never — test if the GC storm
// comes from Effect/JSC itself or opencode's AppLayer fibers.
import { Effect, Logger, Layer } from "effect"
import path from "path"
import os from "os"

const logFile = path.join(os.tmpdir(), "effect-min-test.log")

const program = Effect.gen(function* () {
  yield* Effect.logInfo("boot")
  yield* Effect.never
}).pipe(
  Effect.provide(Layer.setLogger(Logger.batched(Logger.formatStructured, {
    window: 1000,
    flush: (msgs) => Effect.sync(() => {
      // mimic opencode: write via fs append — but keep it simple
    }),
  }))),
)

await Effect.runPromise(program)
