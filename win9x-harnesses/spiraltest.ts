// Spiral test: retain a big heap, stay otherwise idle, watch for forced GCs.
const retained: any[] = []
for (let i = 0; i < 500000; i++) retained.push({ a: i, b: "" + i, c: [i] })
console.error("retained", retained.length)
setInterval(() => {}, 1000000)
