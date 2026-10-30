---
title: Windows DLL functions indirections
description: Redirecting calls to functions of a linked DLL through an injected or linked DLL, and calling the original function without any changes to the DLL's original API.
date: 2026-06-1
image: /assets/img/inderect.png
featured: true
tags: [C++, Windows]
technologies: [C++, Windows]
---


<h1>
Windows DLL function indirection
</h1>

Some applications, such as profilers or debugging tools, need to track calls into a shared library (a DLL on Windows) without changing the code of the tracked software or the DLL itself. To the application the API stays the same, but under the hood its function calls are redirected to a middleman, which then executes the original function and returns the same result the original code expects.

An example of this is RenderDoc for DirectX 12. When an application is launched through RenderDoc, a special DLL is injected into it that implements these function indirections for DirectX 12. They allow RenderDoc to wrap DirectX 12 objects and track your calls and objects without any change to your code. This is also why the DLL must be injected before any DirectX 12 object is created.

This post describes a small hooking system for Windows only, as the technique is platform specific. How to inject a DLL into an application is not covered here.
Indirection works by patching the first bytes of the target function with a jump into our own function, while keeping a "trampoline" that still lets us call the original. These concepts are explained further below.

<h2>Overview</h2>
For every hooked function three pieces of memory are involved:

* **Patch** - the first 5 bytes of the original function are overwritten with a near jump.
* **Stub** - an absolute jump to our hook function.
* **Trampoline** - the 5 original bytes we overwrote, followed by an absolute jump back into the original function right after the patch.

The call flow then looks like this:

![Call flow](/assets/img/indirection.png)

<h2>Jump instructions</h2>
Windows x64 gives us two useful jumps. A near jump `E9 rel32` is only 5 bytes, but can only reach +-2GB from the current instruction. An absolute jump `FF 25 00000000` followed by a 64-bit address can reach anywhere, but takes 14 bytes.

```cpp
#pragma pack(push, 1)
struct AbsJmp {
    uint8_t  op[2] = { 0xFF, 0x25 }; // jmp [rip + 0]
    int32_t  ripRel = 0;
    uint64_t addr = 0;               // target address
};

struct NearJmp {
    uint8_t op = 0xE9;               // jmp rel32
    int32_t rel = 0;
};
#pragma pack(pop)
```

We want to overwrite as few bytes of the original function as possible, because overwriting more bytes increases the chance of breaking something important. That is why the patch is the 5-byte near jump. Our hook function can live anywhere in memory, so the near jump points to a stub, allocated close to the DLL, which contains an absolute jump to the hook. The limited range of the near jump is the only constraint this adds, and it is an acceptable one.

<h2>Allocating memory near the module</h2>
Because the near jump can only reach +-2GB, the stubs and trampolines must be allocated within that range of the DLL. The allocator walks memory page by page from the module base, first backwards and then forwards, and uses `VirtualQuery` to find a free region it can `VirtualAlloc` as executable memory.

```cpp
uint8_t* search = addr;
while (search > lo)
{
    search -= pageSize;
    if (!VirtualQuery(search, &mbi, sizeof(mbi))) continue;
    if (mbi.State != MEM_FREE)                    continue;
    void* mem = VirtualAlloc(search, size,
        MEM_COMMIT | MEM_RESERVE,
        PAGE_EXECUTE_READWRITE);
    if (mem) return mem;
}
```


To reduce the number of memory searches, allocations are grouped per module.
One block is allocated per module and holds all stubs and trampolines for that module's hooks.

<h2>Installing a hook</h2>
For each registered function we look up its address with `GetProcAddress`, then:

1. Copy the first 5 bytes of the function into the trampoline.
2. Write an absolute jump after them pointing to `original + 5`.
3. Store the trampoline address as the "original" function pointer for the user.
4. Write the stub with an absolute jump to the hook function.
5. Overwrite the start of the original function with a near jump to the stub, using `VirtualProtect` to make the code writable for a moment.

```cpp
NearJmp patch;
patch.rel = static_cast<int32_t>(
    reinterpret_cast<uint8_t*>(stub) -
    reinterpret_cast<uint8_t*>(funcPtr) -
    PATCH_SIZE);

DWORD old;
VirtualProtect(funcPtr, PATCH_SIZE, PAGE_EXECUTE_READWRITE, &old);
memcpy(funcPtr, &patch, PATCH_SIZE);
VirtualProtect(funcPtr, PATCH_SIZE, old, &old);
```

<h2>Typed API</h2>
Working with `void*` is error prone, so the public API wraps everything in a small template that keeps the function signature and exposes `CallOriginal`.

```cpp
template<typename Ret, typename... Args>
class FunctionHook
{
public:
    using FuncSig = Ret(WINAPI*)(Args...);

    void Init(const std::string& moduleName, const std::string& funcName, FuncSig funcHook)
    {
        RegisterHook(moduleName, funcName,
            reinterpret_cast<void* const>(funcHook),
            reinterpret_cast<void**>(&m_original));
    }

    Ret CallOriginal(Args... args)
    {
        return m_original(std::forward<Args>(args)...);
    }

private:
    FuncSig m_original = nullptr;
};
```

Usage then looks something like this:

```cpp
// TODO: replace with a real example from the project
static Hooks::FunctionHook<HRESULT, /* args */> g_hook;

HRESULT WINAPI MyHook(/* args */)
{
    // custom code before
    auto result = g_hook.CallOriginal(/* args */);
    // custom code after
    return result;
}

g_hook.Init("module.dll", "FunctionName", &MyHook);
Hooks::ActivateHooks();
```

<h2>Limitations</h2>

* The trampoline copies exactly 5 bytes. This only works if those bytes end on an instruction boundary and contain no RIP-relative instructions. A more robust version would use a length disassembler to copy whole instructions and fix up relative offsets.
* Hooks are installed while other threads may be running. Suspending threads during patching would make it safer.
* Deactivating hooks (restoring the original bytes) is not implemented yet.
* Hooks cannot be added dynamically; all hooks must be registered before they are activated.

<h2>Conclusion</h2>
This relatively small hooking system can handle simple cases of Windows DLL function indirection. Building it helped me explore how Windows handles shared libraries and how to work with memory at a lower level.

The next step is to fix the instruction boundary problem. Instead of always copying exactly 5 bytes, the hook should use a length disassembler to decode the first instructions of the function and copy whole instructions until at least 5 bytes are covered, so the jump back from the trampoline always lands on a real instruction. The same decoding would also make it possible to relocate RIP-relative instructions, or to refuse to hook a function that cannot be patched safely.
