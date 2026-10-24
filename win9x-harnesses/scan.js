const exe = Buffer.from(await Bun.file(process.argv[2]).arrayBuffer());
const dll = Buffer.from(await Bun.file(process.argv[3]).arrayBuffer());
const needle = dll.subarray(Math.floor(dll.length / 2), Math.floor(dll.length / 2) + 96);
console.log("exe", exe.length, "dll", dll.length, "dll_embedded", exe.indexOf(needle) !== -1);
