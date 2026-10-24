import { readFileSync } from "fs"
const prof = JSON.parse(readFileSync("C:/Users/Karthik/AppData/Local/Temp/opencode/prof/CPU.20261009.224931.26416.0.001.cpuprofile", "utf8"))
console.log("keys", Object.keys(prof))
console.log("nodes", prof.nodes?.length, "samples", prof.samples?.length, "timeDeltas", prof.timeDeltas?.length)
const td: number[] = prof.timeDeltas || []
let sum = 0
for (const t of td) sum += t
console.log("total timeDeltas us:", sum, "count", td.length)
const buckets = new Array(10).fill(0)
let acc = 0
const totalT = sum
let bi = 0
for (let i = 0; i < td.length; i++) {
  acc += td[i]
  while (bi < 9 && acc > (totalT * (bi + 1)) / 10) bi++
  buckets[bi]++
}
console.log("samples per time decile:", buckets)
// Build node map
const nodeById = new Map<number, any>()
for (const n of prof.nodes) nodeById.set(n.id, n)
// For last 3 deciles (steady state), attribute self time by function name+url
const startT = totalT * 0.7
const selfHits = new Map<string, number>()
acc = 0
for (let i = 0; i < td.length; i++) {
  acc += td[i]
  if (acc < startT) continue
  const nodeId = prof.samples[i]
  const node = nodeById.get(nodeId)
  if (!node) continue
  const cf = node.callFrame
  const key = `${cf.functionName || "(anon)"} @ ${cf.url || "?"}:${cf.lineNumber ?? "?"}`
  selfHits.set(key, (selfHits.get(key) || 0) + td[i])
}
const sorted = [...selfHits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)
console.log("\n=== STEADY-STATE (last 30% of profile) SELF TIME by function ===")
let totSteady = 0
for (const [k, v] of selfHits) totSteady += v
for (const [k, v] of sorted) {
  console.log(((v / totSteady) * 100).toFixed(1) + "%", (v / 1000).toFixed(0) + "ms", k)
}
// Also attribute by caller: for steady samples on Effect/evaluate, find parent
console.log("\n=== PARENTS of hot steady-state frames (top 10 by aggregate) ===")
