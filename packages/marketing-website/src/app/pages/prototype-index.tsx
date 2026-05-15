export const PrototypeIndex = () => (
  <div className="min-h-screen bg-[#F4F4FB] text-[#0E0E47] font-sans antialiased grid place-items-center px-6">
    <div className="max-w-2xl w-full">
      <div className="font-mono text-[12px] tracking-[0.12em] uppercase text-[#2026A0] mb-3">
        [P] Landing prototypes
      </div>
      <h1 className="text-[40px] leading-[1.1] tracking-tight font-semibold mb-3">
        Pick a treatment.
      </h1>
      <p className="text-[16px] text-[#3A3A6B] mb-10 max-w-[520px]">
        Two prototypes built from the same Notion-inspired patterns —
        bracketed nav, code paired with a terminal-output banner, dotted-line
        diagrams, pixel-tile agents. Same content, opposite palettes.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <a
          href="/light"
          className="block bg-white border border-[#D5D5EC] rounded-md p-6 hover:border-[#2026A0] hover:shadow-[0_8px_24px_-12px_rgba(32,38,160,0.25)] transition"
        >
          <div className="font-mono text-[12px] uppercase tracking-wider text-[#2026A0] mb-2">
            /light
          </div>
          <div className="font-semibold text-[18px] mb-1">Notion-style light</div>
          <div className="text-[14px] text-[#5C5C8C]">Lavender bg, deep indigo accents.</div>
          <div className="mt-4 flex gap-1.5">
            <span className="w-6 h-6 rounded bg-[#F4F4FB] border border-[#D5D5EC]" />
            <span className="w-6 h-6 rounded bg-[#E5E5F7]" />
            <span className="w-6 h-6 rounded bg-[#2026A0]" />
            <span className="w-6 h-6 rounded bg-[#0E0E47]" />
          </div>
        </a>
        <a
          href="/dark"
          className="block bg-[#09090B] border border-[#27272F] rounded-md p-6 text-white hover:border-[#A78BFA] hover:shadow-[0_8px_24px_-12px_rgba(167,139,250,0.4)] transition"
        >
          <div className="font-mono text-[12px] uppercase tracking-wider text-[#A78BFA] mb-2">
            /dark
          </div>
          <div className="font-semibold text-[18px] mb-1">Railway-style dark</div>
          <div className="text-[14px] text-[#8888AA]">Near-black bg, violet accents.</div>
          <div className="mt-4 flex gap-1.5">
            <span className="w-6 h-6 rounded bg-[#09090B] border border-[#27272F]" />
            <span className="w-6 h-6 rounded bg-[#13131A] border border-[#27272F]" />
            <span className="w-6 h-6 rounded bg-[#A78BFA]" />
            <span className="w-6 h-6 rounded bg-white" />
          </div>
        </a>
      </div>
      <div className="mt-10 text-[14px] text-[#5C5C8C]">
        <a href="/" className="hover:text-[#2026A0]">← Current landing</a>
      </div>
    </div>
  </div>
);
