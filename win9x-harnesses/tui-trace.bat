@echo off
set OPENCODE_BOOT_TRACE=1
cd /d D:\WS\OpenCode-Test
echo === start %DATE% %TIME% ===>> D:\WS\OpenCode-Test\boot-trace.log
D:\WS\OpenCode-Test\OpenCode\Bin\opencode.exe 2>> D:\WS\OpenCode-Test\boot-trace.log
echo === end %DATE% %TIME% ===>> D:\WS\OpenCode-Test\boot-trace.log
