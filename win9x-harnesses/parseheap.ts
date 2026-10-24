import { readFileSync } from "fs"
const prof = JSON.parse(readFileSync("C:/Users/Karthik/AppData/Local/Temp/opencode/heapprof/Heap.20261009.225713.68884.0.001.heapprofile", "utf8"))
console.log("keys", Object.keys(prof))
// Chrome heap profile: { head: {callFrame, children:[...], selfSize}, samples: [{timestamp, head:{...}}] }
// Bun's format may differ. Inspect structure.
function walk(node: any, fn: (n: any) => void) {
  fn(node)
  for (const c of node.children || []) walk(c, fn)
}
let nodes = 0
let totalSelf = 0
const selfByFunc = new Map<string, number>()
walk(prof.head, (n) => {
  nodes++
  totalSelf += n.selfSize || 0
  const cf = n.callFrame || {}
  const key = `${cf.functionName || "(anon)"} @ ${cf.url || "?"}:${cf.lineNumber ?? "?"}`
  selfByFunc.set(key, (selfByFunc.get(key) || 0) + (n.selfSize || 0))
})
console.log("nodes", nodes, "totalSelf bytes", totalSelf, "≈", (totalSelf / 1048576).toFixed(1), "MB")
const sorted = [...selfByFunc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)
console.log("\n=== TOP SELF ALLOCATORS ===")
for (const [k, v] of sorted) {
  console.log(((v / totalSelf) * 100).toFixed(2) + "%", (v / 1048576).toFixed(2) + "MB", k)
}
// Also total (self+descendants) for top-level context: find callers of top allocators
// Build parent map
const parents = new Map<any, any>()
walk(prof.head, (n) => { for (const c of n.children || []) parents.set(c, n) })
function frame(n: any) {
  const cf = n.callFrame || {}
  return `${cf.functionName || "(anon)"} @ ${(cf.url || "?").replace(/^file:\/\/\/?/, "").replace(/^.*node_modules[\\\/]/, "nm:")}:${cf.lineNumber ?? "?"}`
}
// total per node
const totalByNode = new Map<any, number>()
function calcTotal(n: any): number {
  let t = n.selfSize || 0
  for (const c of n.children || []) t += calcTotal(c)
  totalByNode.set(n, t)
  return t
}
calcTotal(prof.head)
// For the top-10 self allocators, show 3-level caller chain
console.log("\n=== CALLER CHAINS of top allocators ===")
const topKeys = new Set(sorted.slice(0, 8).map((s) => s[0]))
walk(prof.head, (n) => {
  const cf = n.callFrame || {}
  const key = `${cf.functionName || "(anon)"} @ ${cf.url || "?"}:${cf.lineNumber ?? "?"}`
  if (!topKeys.has(key)) return
  const chain: string[] = []
  let cur: any = n
  for (let i = 0; i < 5 && cur; i++) {
    chain.push(frame(cur))
    cur = parents.get(cur)
  }
  console.log(`--- ${key} self=${((n.selfSize || 0) / 1048576).toFixed(2)}MB total=${((totalByNode.get(n) || 0) / 1048576).toFixed(2)}MB`)
  for (const c of chain) console.log("    <-", c)
})
