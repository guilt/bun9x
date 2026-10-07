// Standalone TU (no includes, no PCH). Defines Win8+ API set symbols that
// don't exist on Windows XP/Win9x. Produces x86 stdcall decorated names
// matching synchronization.lib, so the linker resolves them instead of
// importing from api-ms-win-core-synch-l1-2-0.dll (excluded via
// /NODEFAULTLIB:synchronization.lib in flags.ts).
//
// Rust's -Zbuild-std uses dllimport on x86 MSVC targets, which generates
// references to __imp__WaitOnAddress@16 etc. These references are redirected
// via pragma alternatename (below) to the _WaitOnAddress@16 symbols defined
// here, preventing the linker from extracting the import object members from
// bun_rust.lib.

#pragma comment(linker, "/alternatename:__imp__WaitOnAddress@16=_WaitOnAddress@16")
#pragma comment(linker, "/alternatename:__imp__WakeByAddressAll@4=_WakeByAddressAll@4")
#pragma comment(linker, "/alternatename:__imp__WakeByAddressSingle@4=_WakeByAddressSingle@4")
#pragma comment(linker, "/alternatename:__imp__ProcessPrng@8=_ProcessPrng@8")
#pragma comment(linker, "/alternatename:__imp__RtlWaitOnAddress@16=_RtlWaitOnAddress@16")
#pragma comment(linker, "/alternatename:__imp__RtlWakeAddressAll@4=_RtlWakeAddressAll@4")
#pragma comment(linker, "/alternatename:__imp__RtlWakeAddressSingle@4=_RtlWakeAddressSingle@4")
#pragma comment(linker, "/alternatename:__imp__RtlExitUserProcess@4=_RtlExitUserProcess@4")
#pragma comment(linker, "/alternatename:__imp__RtlRestoreContext@8=_RtlRestoreContext@8")


extern "C" {

// Kernel32 (declared so this standalone TU needs no includes).
unsigned long __stdcall GetTickCount(void);
void __stdcall Sleep(unsigned long);
void* __stdcall CreateEventA(void*, int, int, const char*);
int __stdcall SetEvent(void*);
int __stdcall CloseHandle(void*);
unsigned long __stdcall WaitForSingleObject(void*, unsigned long);
void __stdcall SetLastError(unsigned long);
void __stdcall GetSystemTimeAsFileTime(void*);
long _InterlockedCompareExchange(long volatile*, long, long);

// WaitOnAddress family (Windows 8+; not on XP). XP-safe blocking built on one
// auto-reset event: WaitOnAddress re-checks the comparand every 50ms slice, so
// a wake landing on the wrong waiter (or a lost race while the event is first
// created) delays a wakeup by at most 50ms instead of forever. Mimalloc's
// scavenger thread and bmalloc/libpas both park here for seconds at a time —
// returning immediately turns them into 100% CPU busy loops.
static volatile long g_woa_event;

static void* woa_event() {
    long ev = g_woa_event;
    if (ev) return (void*)ev;
    ev = (long)CreateEventA(0, 0, 0, 0);
    if (!ev) return 0;
    long prev = _InterlockedCompareExchange(&g_woa_event, ev, 0);
    if (prev != 0) {
        CloseHandle((void*)ev);
        return (void*)prev;
    }
    return (void*)ev;
}

static void woa_wake() {
    void* ev = (void*)g_woa_event;
    if (ev) SetEvent(ev);
}

static int woa_equal(void volatile* a, void* b, unsigned long n) {
    const volatile unsigned char* x = (const volatile unsigned char*)a;
    const unsigned char* y = (const unsigned char*)b;
    for (unsigned long i = 0; i < n; i++) {
        if (x[i] != y[i]) return 0;
    }
    return 1;
}

// Returns 1 when *Address differs from CompareAddress, 0 on timeout.
// total_ms 0xFFFFFFFF = infinite.
static int woa_wait(void volatile* Address, void* CompareAddress, unsigned long Size, unsigned long total_ms) {
    unsigned long start = GetTickCount();
    for (;;) {
        if (!woa_equal(Address, CompareAddress, Size)) return 1;
        unsigned long elapsed = GetTickCount() - start;
        if (total_ms != 0xFFFFFFFFul && elapsed >= total_ms) return 0;
        unsigned long slice = 50;
        if (total_ms != 0xFFFFFFFFul && total_ms - elapsed < slice) slice = total_ms - elapsed;
        void* ev = woa_event();
        if (ev) WaitForSingleObject(ev, slice);
        else Sleep(slice);
    }
}

int __stdcall WaitOnAddress(void volatile* Address, void* CompareAddress, unsigned long AddressSize, unsigned long dwMilliseconds) {
    if (woa_wait(Address, CompareAddress, AddressSize, dwMilliseconds)) return 1;
    SetLastError(1460); // ERROR_TIMEOUT
    return 0;
}

void __stdcall WakeByAddressAll(void*) { woa_wake(); }
void __stdcall WakeByAddressSingle(void*) { woa_wake(); }

int __stdcall SystemFunction036(void*, unsigned long);

int __stdcall ProcessPrng(void* pbData, unsigned long cbData) {
    return SystemFunction036(pbData, cbData);
}

int __stdcall BCryptGenRandom(void*, void* pbBuffer, unsigned long cbBuffer, unsigned long) {
    return SystemFunction036(pbBuffer, cbBuffer) ? 0 : -1;
}

// ntdll Rtl sync APIs (Windows 8+); not available on XP. Bun's Futex module
// (src/threading/Futex.rs) uses RtlWaitOnAddress and PANICS on any return
// code other than STATUS_SUCCESS (0) or STATUS_TIMEOUT (0x102). Same event
// wait as above: block while *Address == *CompareAddress.

int __stdcall RtlWaitOnAddress(void volatile* Address, void* CompareAddress, unsigned long AddressSize, void* Timeout) {
    unsigned long total_ms = 0xFFFFFFFFul;
    if (Timeout != nullptr) {
        long long t100 = *(long long*)Timeout;
        if (t100 == 0) {
            total_ms = 0;
        } else if (t100 < 0) {
            // Negative LARGE_INTEGER = relative duration in 100ns units.
            unsigned long long ms = (unsigned long long)(-t100) / 10000;
            total_ms = ms > 0xFFFFFFFEull ? 0xFFFFFFFEul : (unsigned long)ms;
        } else {
            // Positive = absolute FILETIME deadline.
            long long now = 0;
            GetSystemTimeAsFileTime(&now);
            long long remain = t100 - now;
            if (remain <= 0) {
                total_ms = 0;
            } else {
                unsigned long long ms = (unsigned long long)remain / 10000;
                total_ms = ms > 0xFFFFFFFEull ? 0xFFFFFFFEul : (unsigned long)ms;
            }
        }
    }
    if (woa_wait(Address, CompareAddress, AddressSize, total_ms)) return 0;
    return 0x102;
}

void __stdcall RtlWakeAddressAll(void*) { woa_wake(); }

void __stdcall RtlWakeAddressSingle(void*) { woa_wake(); }

// RtlRestoreContext: ntdll export differs between x86 cdecl and stdcall.
// Our stub provides the stdcall version (@8) directly.

void __stdcall RtlRestoreContext(void*, void*) {}

// ntdll RtlExitUserProcess: not available on XP (only RtlExitUserThread).
void __stdcall ExitProcess(unsigned int);

void __stdcall RtlExitUserProcess(unsigned long uExitCode) {
    ExitProcess(uExitCode);
}

}
