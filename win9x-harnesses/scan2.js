const exe = Buffer.from(await Bun.file(process.argv[2]).arrayBuffer());
for (const m of ["OPENCODE_JSC_GC_FIXED","__jscFixRespawn","OPENCODE_BURN_STAGE","wrapCtor"]) console.log(m, exe.includes(Buffer.from(m)));
