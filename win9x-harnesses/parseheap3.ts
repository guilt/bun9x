import { readFileSync } from "fs"
const prof = JSON.parse(readFileSync("C:/Users/Karthik/AppData/Local/Temp/opencode/heapprof/Heap.20261009.225713.68884.0.001.heapprofile", "utf8"))
const { nodes, edges, strings } = prof
console.log("nodes len", nodes.length, "edges len", edges.length, "strings len", strings.length)
console.log("snapshot keys", Object.keys(prof.snapshot || {}))
console.log("meta", JSON.stringify(prof.snapshot?.meta || {}).slice(0, 1500))
// try to infer stride: name indices must be < strings.length and plausible
for (const stride of [5, 6, 7]) {
  let ok = true
  let bad = 0
  for (let i = 0; i < Math.min(nodes.length, 10000); i += stride) {
    const nameIdx = nodes[i + 1]
    if (typeof nameIdx !== "number" || nameIdx < 0 || nameIdx >= strings.length) { bad++ }
  }
  console.log(`stride ${stride}: bad name indices in first 10k fields: ${bad}`)
}
// print first 3 nodes under stride 6 assumption
const stride = 6
for (let i = 0; i < stride * 3; i += stride) {
  const [id, name, selfSize, edgeCount] = [nodes[i], nodes[i + 1], nodes[i + 2], nodes[i + 3]]
  console.log({ id, name: strings[name], selfSize, edgeCount })
}
