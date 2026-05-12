import "../../styles.css";

export const Landing = () => (
  <>
    <nav className="flex items-center gap-6 border-b border-zinc-200 px-6 py-4">
      <a
        href="/"
        className="text-sm font-semibold tracking-wide text-zinc-900"
      >
        machinen
      </a>
      <div className="ml-auto flex gap-5">
        <a
          href="https://github.com/redwoodjs/machinen.dev"
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          GitHub
        </a>
      </div>
    </nav>
    <main className="mx-auto max-w-3xl px-6 pt-20 pb-24">
      <img
        src="/logo.svg"
        alt="machinen"
        className="mb-8 block h-auto w-full max-w-[480px]"
      />
      <p className="mb-10 text-xl leading-snug tracking-tight">
        A VM with a single goal: hand off between hosts.
      </p>
      <div className="rounded-r border-l-4 border-yellow-600 bg-yellow-100 px-4 py-3 text-sm text-yellow-900">
        The source code isn't published yet — it'll be available here soon.
      </div>
    </main>
  </>
);
