import "../../styles.css";

export const Landing = () => (
  <div className="min-h-screen">
    <nav className="flex items-center gap-6 border-b border-zinc-800/80 px-6 py-4 backdrop-blur">
      <a
        href="/"
        className="text-sm font-semibold tracking-wide text-zinc-100"
      >
        machinen
      </a>
      <div className="ml-auto flex gap-5">
        <a
          href="https://github.com/redwoodjs/machinen.dev"
          className="text-sm text-zinc-400 hover:text-zinc-100"
        >
          GitHub
        </a>
      </div>
    </nav>
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.20),_transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent"
      />
      <main className="relative mx-auto max-w-3xl px-6 pt-24 pb-32">
        <img
          src="/logo.svg"
          alt="machinen"
          className="mb-14 block h-auto w-full max-w-[280px]"
        />
        <p className="mb-5 font-mono text-xs uppercase tracking-[0.2em] text-indigo-300">
          Handoff for VMs.
        </p>
        <h1 className="mb-6 text-5xl leading-[1.05] font-bold tracking-tight text-white md:text-6xl">
          Run frontier AI locally.
        </h1>
        <p className="mb-12 max-w-2xl text-xl leading-snug text-zinc-400">
          Pause, resume, or fork VMs to run on different hosts.
        </p>
        <div className="rounded-r border-l-2 border-amber-500/60 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          The source code isn't published yet — it'll be available here soon.
        </div>
      </main>
    </div>
  </div>
);
