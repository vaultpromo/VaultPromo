export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-medium tracking-widest text-violet-400 uppercase">
          Beta
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">PromoVault</h1>
        <p className="max-w-md text-zinc-400">
          Secure audio promotion distribution for independent labels. Send promos, collect
          feedback, track every play.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <a
          href="/login"
          className="rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
        >
          Get started
        </a>
        <a
          href="/promo"
          className="rounded-lg border border-zinc-700 px-6 py-2.5 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white"
        >
          View a promo
        </a>
      </div>
    </main>
  );
}
