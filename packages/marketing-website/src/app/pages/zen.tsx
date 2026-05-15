import { ZenGarden } from "./ZenGarden";

export const ZenGardenPage = () => (
  <div className="min-h-screen bg-[#F4F4FB] text-[#0E0E47] font-sans antialiased grid place-items-center px-6">
    <div className="max-w-2xl w-full">
      <div className="font-mono text-[12px] tracking-[0.12em] uppercase text-[#2026A0] mb-3">
        [P] Interactive element
      </div>
      <h1 className="text-[40px] leading-[1.1] tracking-tight font-semibold mb-2">
        Mom, can we have a cloud VM?
      </h1>
      <p className="text-[20px] text-[#3A3A6B] mb-6">
        We have VMs at home.
      </p>
      <ZenGarden />
      <p className="text-[16px] text-[#3A3A6B] mt-4 max-w-[520px]">
        <span className="text-[#5C5C8C]">VMs at home:</span>{" "}
        <strong className="text-[#0E0E47]">machinen</strong> — a MicroVM that
        runs on macOS and Linux. And teleports between them.
      </p>
      <div className="mt-8 text-[14px] text-[#5C5C8C]">
        <a href="/" className="hover:text-[#2026A0]">
          ← Current landing
        </a>
      </div>
    </div>
  </div>
);
