import { readFileSync } from "fs"
const prof = JSON.parse(readFileSync("C:/Users/Karthik/AppData/Local/Temp/opencode/heapprof/Heap.20261009.225713.68884.0.001.heapprofile", "utf8"))
const { nodes, edges, locations, strings, samples } = prof
// nodes: [nodeId, size, nameIndex, callFrameIndex, childrenStart?, ...] — need actual stride. Inspect first entries.
console.log("nodes[0..20]:", nodes.slice(0, 20))
console.log("edges[0..10]:", edges.slice(0, 10))
console.log("locations[0..10]:", locations.slice(0, 10))
console.log("samples[0..10]:", samples.slice(0, 10))
console.log("strings[0..15]:", strings.slice(0, 15))
console.log("nodeCount?", prof.node_count, "total", nodes.length)
