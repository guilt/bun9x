// Threshold test: how much retained heap triggers the idle GC spiral?
const n = parseInt(process.argv[2] || "100000", 10)
const retained: any[] = []
for (let i = 0; i < n; i++) retained.push({ a: i, b: "" + i, c: [i] })
console.error("retained", retained.length)
setInterval(() => {}, 1000000)
