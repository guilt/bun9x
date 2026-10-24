import { readFileSync } from "fs"
const dir = "D:\\WS\\OpenCode\\packages\\opencode\\dist\\opencode-windows-x86\\bin"

function tally(f: string) {
  const s = JSON.parse(readFileSync(`${dir}\\${f}`, "utf8"))
  const classes: string[] = s.nodeClassNames
  const nodes: number[] = s.nodes
  const map = new Map<string, { n: number; deadN: number; bytes: number; deadBytes: number }>()
  for (let i = 0; i < nodes.length; i += 4) {
    const size = nodes[i + 1]
    const cls = classes[nodes[i + 2]] ?? `#${nodes[i + 2]}`
    const alive = nodes[i + 3]
    const cur = map.get(cls) ?? { n: 0, deadN: 0, bytes: 0, deadBytes: 0 }
    if (alive) { cur.n++; cur.bytes += size } else { cur.deadN++; cur.deadBytes += size }
    map.set(cls, cur)
  }
  return { map, total: nodes.length / 4 }
}

const A = tally("snapA.json")
const B = tally("snapB.json")
console.log(`nodes A=${A.total} B=${B.total} delta=${B.total - A.total}`)

const rows: Array<[string, number, number, number, number]> = []
for (const [cls, v] of B.map) {
  const p = A.map.get(cls) ?? { n: 0, deadN: 0, bytes: 0, deadBytes: 0 }
  rows.push([cls, v.n - p.n, v.bytes - p.bytes, p.bytes, v.bytes])
}
rows.sort((x, y) => y[2] - x[2])
console.log("\n=== ALIVE byte growth top 30 (cls, +nodes, +bytes, A->B) ===")
for (const r of rows.slice(0, 30)) console.log(`${r[0]}\t+${r[1]}\t+${r[2]}\t${r[3]} -> ${r[4]}`)

rows.sort((x, y) => y[1] - x[1])
console.log("\n=== ALIVE node growth top 30 ===")
for (const r of rows.slice(0, 30)) console.log(`${r[0]}\t+${r[1]}\t+${r[2]}\t${r[3]} -> ${r[4]}`)

// dead totals
let deadA = 0, deadB = 0, deadNA = 0, deadNB = 0
for (const v of A.map.values()) { deadA += v.deadBytes; deadNA += v.deadN }
for (const v of B.map.values()) { deadB += v.deadBytes; deadNB += v.deadN }
console.log(`\ndead in A: ${deadNA} nodes ${deadA}B ; dead in B: ${deadNB} nodes ${deadB}B`)
