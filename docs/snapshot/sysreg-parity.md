# ARM64 sysreg parity audit (HVF ↔ KVM)

What the snapshot/restore project needs to know before writing the
vCPU dump+load translators (tasks #18, #19): for every system
register reachable on either VMM backend, can we treat its bytes as
portable state, or does it need special handling?

## Coverage (captured 2026-05-14, macOS 15.5 / Linux 6.x on Apple

Silicon and Ampere arm64)

| Backend                    | Total regs | `ok` | `unsupported` |
| -------------------------- | ---------- | ---- | ------------- |
| HVF (macOS 15.5, M-series) | 148        | 120  | 28            |
| KVM (Linux arm64)          | 160        | 160  | 0             |

| Set                       | Count                                            |
| ------------------------- | ------------------------------------------------ |
| Encodings present in both | 103                                              |
| HVF-only encodings        | 45 (mostly EL2 + macOS-15.2-gated)               |
| KVM-only encodings        | 57 (KVM-exposed regs absent from `hv_sys_reg_t`) |

Fixtures committed at `packages/microvm/test-fixtures/snapshot/`:

- `sysregs-hvf.txt` — `0xENC<TAB>NAME<TAB>STATUS[<TAB>VALUE]` from
  `hv_vcpu_get_sys_reg` on every `HV_SYS_REG_*` value.
- `sysregs-kvm.txt` — same shape from `KVM_GET_REG_LIST` +
  `KVM_GET_ONE_REG`. Registers Apple doesn't enumerate carry the
  generic `S<op0>_<op1>_C<CRn>_C<CRm>_<op2>` name.

Regenerate either side by re-running `sysreg-probe`:

```bash
# macOS (HVF)
zig build && codesign -s - --force \
  --entitlements packages/microvm/entitlements.plist \
  packages/microvm/zig-out/bin/sysreg-probe
packages/microvm/zig-out/bin/sysreg-probe \
  > packages/microvm/test-fixtures/snapshot/sysregs-hvf.txt

# Linux arm64 (KVM)
zig build -Dtarget=aarch64-linux-musl -Doptimize=ReleaseSafe
scp packages/microvm/zig-out/bin/sysreg-probe <linux-host>:/tmp/
ssh <linux-host> /tmp/sysreg-probe \
  > packages/microvm/test-fixtures/snapshot/sysregs-kvm.txt
```

To pull a fresh name table from the macOS SDK:

```bash
perl -ne 'if (/HV_SYS_REG_([A-Za-z0-9_]+).*?=\s*(0x[0-9a-fA-F]+)/) {
  print "    .{ .encoding = $2, .name = \"$1\" },\n"
}' \
  /Library/Developer/CommandLineTools/SDKs/MacOSX*.sdk/System/Library/Frameworks/Hypervisor.framework/Versions/A/Headers/hv_vcpu_types.h
```

## Classification

Every register is in exactly one bucket. The translator (#18/#19)
honours these:

- **portable** — bytes are guest-set state; dump on side A, write
  verbatim on side B, expect equality on a structural diff.
- **mask** — read for completeness, written on restore, but excluded
  from the diff. Bytes legitimately diverge across hosts even when
  the guest didn't move (PMU counters, debug breakpoint state nobody
  set, host-determined timing fields).
- **translate** — bytes are host-relative. Need an adjustment when
  ferrying between hosts (timer offsets, vmpidr).
- **skip** — invariants that must match across hosts. Don't transfer
  via snapshot; instead, enforce equality at restore time. Mismatch
  → refuse to restore.

| Class                   | Examples                                                                                                                                                                            | Decision                                                                                              | Why                                                                                                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity / discovery    | `ID_AA64*_EL1`, `MIDR_EL1`, `REVIDR_EL1`, `MPIDR_EL1`, `AIDR_EL1`                                                                                                                   | **skip**                                                                                              | Host-determined feature/identity bits. The boot-time topology check (task #25) asserts equality; transferring them via snapshot is redundant and would mask mismatches.                                         |
| Implementation-defined  | `ACTLR_EL1`, `ACTLR_EL2`, `S3_1_C15_*` (Apple proprietary)                                                                                                                          | **skip**                                                                                              | Vendor-defined bits with no spec contract. Cross-vendor copy is unsound.                                                                                                                                        |
| Cache topology          | `CCSIDR_EL1`, `CCSIDR2_EL1`, `CSSELR_EL1`, `CLIDR_EL1`, `CTR_EL0`, `DCZID_EL0`                                                                                                      | **skip**                                                                                              | Host cache geometry. Guest reads these but they describe the _host_; cross-host transfer is wrong.                                                                                                              |
| Translation regime      | `SCTLR_EL1`, `TCR_EL1`, `TCR2_EL1`, `TTBR0_EL1`, `TTBR1_EL1`, `MAIR_EL1`, `AMAIR_EL1`, `VBAR_EL1`, `ELR_EL1`, `ESR_EL1`, `FAR_EL1`, `SPSR_*`                                        | **portable**                                                                                          | Pure guest state.                                                                                                                                                                                               |
| Exception / banked regs | `SP_EL0`, `SP_EL1`, `SP_EL2`, `ELR_EL2`, `SPSR_EL2`, `HCR_EL2`, `HSTR_EL2`, `VPIDR_EL2`, `VMPIDR_EL2`, `VTCR_EL2`, `VTTBR_EL2`                                                      | **portable** (EL2 if guest uses EL2)                                                                  | Guest state.                                                                                                                                                                                                    |
| Thread pointers         | `TPIDR_EL0`, `TPIDR_EL1`, `TPIDRRO_EL0`, `TPIDR2_EL0`                                                                                                                               | **portable**                                                                                          | Guest TLS.                                                                                                                                                                                                      |
| Floating-point ctrl     | `FPCR`, `FPSR`, `MVFR0_EL1`, `MVFR1_EL1`, `MVFR2_EL1`                                                                                                                               | **portable** (FPCR/FPSR), **skip** (MVFR\* — host caps)                                               | FPCR/FPSR are guest state. MVFR\* describe the host FPU.                                                                                                                                                        |
| Generic timer           | `CNTV_CTL_EL0`, `CNTV_CVAL_EL0`, `CNTV_TVAL_EL0`, `CNTP_CTL_EL0`, `CNTP_CVAL_EL0`, `CNTP_TVAL_EL0`, `CNTKCTL_EL1`                                                                   | **portable**                                                                                          | Programmed by the guest. CVAL is absolute against the virtual counter — together with the offset (next row) it round-trips.                                                                                     |
| Counter offsets         | `CNTVOFF_EL2`, `CNTPOFF_EL2`, `CNTHCTL_EL2`                                                                                                                                         | **translate**                                                                                         | Host-monotonic offset from physical to virtual counter. On restore, subtract the _new_ host's `CNTPCT_EL0` and add the old guest's expected virtual counter value, or the guest jumps forward/backward in time. |
| PMU counters            | `PMCR_EL0`, `PMCCNTR_EL0`, `PMEVCNTR0..30_EL0`, `PMEVTYPER0..30_EL0`, `PMCCFILTR_EL0`                                                                                               | **mask**                                                                                              | Counters tick at host-CPU rates; cycle/instr counts are not portable. Restore writes the dumped values so a guest reading PMCR sees a sensible state, but the diff doesn't enforce equality.                    |
| PMU control             | `PMCNTENSET_EL0`, `PMCNTENCLR_EL0`, `PMOVSCLR_EL0`, `PMOVSSET_EL0`, `PMINTENSET_EL1`, `PMINTENCLR_EL1`, `PMUSERENR_EL0`, `PMSELR_EL0`, `PMXEVCNTR_EL0`, `PMXEVTYPER_EL0`            | **portable**                                                                                          | Configuration flags — guest-set.                                                                                                                                                                                |
| Debug                   | `DBGBVR0..15_EL1`, `DBGBCR0..15_EL1`, `DBGWVR0..15_EL1`, `DBGWCR0..15_EL1`, `MDSCR_EL1`, `OSDTRRX_EL1`, `OSDTRTX_EL1`, `OSLAR_EL1`, `OSLSR_EL1`, `MDCCINT_EL1`, `DBGAUTHSTATUS_EL1` | **mask** today, **portable** later                                                                    | A guest _can_ set debug regs and expect them to persist. Until task #29 (debug session survival) we don't snapshot mid-session; mask for the first cut. Reclassify when the test that fails forces our hand.    |
| Pointer auth keys       | `APIAKEY{LO,HI}_EL1`, `APIBKEY{LO,HI}_EL1`, `APDAKEY{LO,HI}_EL1`, `APDBKEY{LO,HI}_EL1`, `APGAKEY{LO,HI}_EL1`                                                                        | **portable**                                                                                          | Guest-set. Restore-side correctness depends on the kernel re-deriving signed pointers from the same keys.                                                                                                       |
| SVE / SME               | `ZCR_EL1`, `ZCR_EL2`, `SMCR_EL1`, `SMPRI_EL1`, `SMIDR_EL1`, `TPIDR2_EL0`, `SVCR`                                                                                                    | **portable** (state), **skip** (`SMIDR_EL1`, `ID_AA64ZFR0_EL1`, `ID_AA64SMFR0_EL1` — capability bits) | Mac M-series exposes SME; most KVM hosts don't. The ID regs are host-feature reports — if they disagree, snapshot must refuse restore. The actual SVE/SME state regs (`ZCR*`, `SMCR*`) are guest state.         |
| GIC system regs         | `ICC_*`                                                                                                                                                                             | tracked separately (#22)                                                                              | GIC state has its own section in `.vmstate`; the per-CPU sysreg interface to GICv3 is captured under `gic_redist`.                                                                                              |
| RAS                     | `DISR_EL1`, `VDISR_EL2`, `ERR*`, `VSESR_EL2`                                                                                                                                        | **portable**                                                                                          | Error state.                                                                                                                                                                                                    |
| Misc                    | `CONTEXTIDR_EL1`, `CONTEXTIDR_EL2`, `SCXTNUM_EL0`, `SCXTNUM_EL1`, `RNDR`, `RNDRRS`                                                                                                  | **portable** (CONTEXTIDR), **skip** (`RNDR*` — host RNG, no state)                                    |                                                                                                                                                                                                                 |

## Specific things to watch for

1. **`CNTVOFF_EL2` is not portable.** Reading on host A returns a
   value that anchors the guest's virtual counter to host A's
   physical counter. On host B the physical counter has a different
   epoch, so the same bytes would jump the guest's virtual time. The
   translator must do
   `new_CNTVOFF = old_CNTPCT - new_CNTPCT + old_CNTVOFF` at restore.
2. **`MPIDR_EL1` / `VMPIDR_EL2` affinity bits.** Apple's GIC binding
   needs `MPIDR_EL1` set before the first vCPU run. The guest's view
   of MPIDR (via `VMPIDR_EL2`) must match between dump and restore;
   the topology check (#25) covers this.
3. **`SMIDR_EL1` and SME ID regs.** Mac exposes SME with non-zero
   feature bits. Most KVM hosts will return all-zero. Snapshot must
   refuse restore when SME-ID changes from non-zero to zero — that's
   "you lost a feature mid-flight".
4. **`PMCR_EL0` enable bits are portable; counter values are not.**
   Restore must write the dumped counter values (so reads don't
   randomly jump) but the diff treats them as masked. Same with
   `PMCCNTR_EL0` and `PMEVCNTRn_EL0`.
5. **57 KVM-only encodings.** These aren't in Apple's `hv_sys_reg_t`
   so we can't read them on Mac. For cross-VMM round-trips, if the
   restore side has the reg but the dump side didn't, write a
   spec-default (typically zero or `RES1` per ARM ARM). For the
   reverse — HVF dumped a value KVM doesn't expose — refuse restore;
   that's a real feature mismatch, not something to paper over.
6. **`ID_AA64*` regs**. Comparing these between hosts is the most
   reliable feature-mismatch detector we have. Snapshot's
   topology-hash header (task #25) will incorporate them.

## What this doesn't (yet) cover

- The 28 HVF-`unsupported` registers are mostly EL2 regs and
  macOS-15.2-gated additions (SME) that the M-series host this
  audit ran on doesn't surface. They'll show up on M3/M4 or
  macOS 16. The classification table is forward-compatible: even if
  the probe can't read a reg today, its decision is determined by
  its class.
- We haven't probed against a Linux 6.10+ KVM with SVE2/SME2 enabled.
  When that lands, expect another ~30 KVM-only encodings — likely
  classified as **portable** under the SVE/SME row.
- The "debug regs are mask today, portable later" call is honest
  scope-cutting. The first round-trip target (deterministic harness
  with no userspace debugger) doesn't exercise them.
