import { readFileSync } from "fs"
const prof = JSON.parse(readFileSync("C:/Users/Karthik/AppData/Local/Temp/opencode/heapprof/Heap.20261009.225713.68884.0.001.heapprofile", "utf8"))
const { nodes, edges, strings, snapshot } = prof
const stride = 7
const nodeCount = nodes.length / stride
const types = snapshot.meta.node_types[0]
const edgeTypes = snapshot.meta.edge_types[0]
const byType = new Map<string, { count: number; bytes: number }>()
let totalBytes = 0
for (let i = 0; i < nodeCount; i++) {
  const o = i * stride
  const type = types[nodes[o]]
  const name = strings[nodes[o + 1]]
  const selfSize = nodes[o + 3]
  totalBytes += selfSize
  const key = `${type}:${name}`
  const e = byType.get(key) || { count: 0, bytes: 0 }
  e.count++
  e.bytes += selfSize
  byType.set(key, e)
}
console.log("nodeCount", nodeCount, "total self bytes", (totalBytes / 1048576).toFixed(1), "MB")
const sorted = [...byType.entries()].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 40)
console.log("\n=== TOP self_size by type:name ===")
for (const [k, v] of sorted) {
  console.log(((v.bytes / totalBytes) * 100).toFixed(2) + "%", (v.bytes / 1048576).toFixed(2) + "MB", "x" + v.count, k)
}
// edges stride 3: type, name_or_index, to_node (to_node is offset into nodes array)
const edgeStride = 3
const edgeCount = edges.length / edgeStride
// Build incoming edge counts and parent (first parent) per node
const parent = new Int32Array(nodeCount).fill(-1)
const incoming = new Int32Array(nodeCount)
for (let e = 0; e < edgeCount; e++) {
  const eo = e * edgeStride
  const toOffset = edges[eo + 2]
  const toIdx = toOffset / stride
  incoming[toIdx]++
  if (parent[toIdx] === -1) parent[toIdx] = edges[eo] === 0 ? parentIdxFromOffset(edges, e, stride) : -2 // placeholder
}
// simpler: store parent node index from to_node's source — need source offset. Re-walk storing from:
const parent2 = new Int32Array(nodeCount).fill(-1)
for (let e = 0; e < edgeCount; e++) {
  const eo = e * edgeStride
  // to_node field is byte offset of target node in nodes array? In V8 format to_node is node offset in nodes array (already offset, not index)
  const toOffset = edges[eo + 2]
  const toIdx = Math.floor(toOffset / stride)
  if (toIdx >= 0 && toIdx < nodeCount && parent2[toIdx] === -1) {
    // find source: V8 edge format doesn't include source — edges are grouped per node in order. Actually in .heapprofile/.heapsnapshot, edges array is flat with to_node only; source is implied by ordering: each node has edge_count consecutive edges. So track running edge cursor per node order.
  }
}
// Correct approach: iterate nodes in order, each consumes edge_count edges
let edgeCursor = 0
const retained = new Float64Array(nodeCount) // approx retained = self + descendants not reachable otherwise — skip for now; instead aggregate subtree size per root-ish
const subtree = new Float64Array(nodeCount)
const stack: number[] = []
// compute subtree sizes via reverse topo: children first. Build children lists.
const childrenOf: number[][] = Array.from({ length: nodeCount }, () => [])
const firstParent = new Int32Array(nodeCount).fill(-1)
edgeCursor = 0
for (let i = 0; i < nodeCount; i++) {
  const edgeCountI = nodes[i * stride + 4]
  for (let k = 0; k < edgeCountI; k++) {
    const eo = edgeCursor * edgeStride
    const toOffset = edges[eo + 2]
    const toIdx = Math.floor(toOffset / stride)
    if (toIdx >= 0 && toIdx < nodeCount) {
      childrenOf[i].push(toIdx)
      if (firstParent[toIdx] === -1) firstParent[toIdx] = i
    }
    edgeCursor++
  }
}
// subtree sizes (iterative postorder to avoid recursion depth)
const postorder: number[] = []
const visited = new Uint8Array(nodeCount)
const itStack: number[] = [0]
while (itStack.length) {
  const n = itStack.pop()
  if (visited[n]) continue
  visited[n] = 1
  postorder.push(n)
  for (const c of childrenOf[n]) if (!visited[c]) itStack.push(c)
}
for (let i = postorder.length - 1; i >= 0; i--) {
  const n = postorder[i]
  let s = nodes[n * stride + 3]
  for (const c of childrenOf[n]) s += subtree[c]
  subtree[n] = s
}
// top subtree holders
const byIdx = [...Array(nodeCount).keys()]
byIdx.sort((a, b) => subtree[b] - subtree[a])
console.log("\n=== TOP retained-subtree holders (root-ish objects) ===")
for (const i of byIdx.slice(0, 25)) {
  const type = types[nodes[i * stride]]
  const name = strings[nodes[i * stride + 1]]
  const selfSize = nodes[i * stride + 3]
  const parentIdx = firstParent[i]
  let ptxt = "(root)"
  if (parentIdx >= 0) {
    ptxt = `${types[nodes[parentIdx * stride]]}:${strings[nodes[parentIdx * stride + 1]]}`
  }
  console.log(
    (subtree[i] / 1048576).toFixed(2) + "MB subtree",
    "self=" + (selfSize / 1024).toFixed(0) + "KB",
    "in=" + incoming[i],
    `${type}:${name}`,
    "<- parent:", ptxt,
  )
}
function parentIdxFromOffset(_edges: number[], _e: number, _s: number) { return -1 }
