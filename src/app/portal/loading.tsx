/**
 * Portal loading skeleton.
 *
 * Mirrors the real dashboard layout closely enough that the content does not
 * jump when it arrives, and announces the wait to assistive technology instead
 * of leaving the screen silent.
 */
export default function PortalLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your portal…</span>

      <div className="space-y-3">
        <div className="h-8 w-64 max-w-full animate-pulse rounded-md bg-slate-200" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-slate-200/70" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="h-5 w-48 animate-pulse rounded-md bg-slate-200" />
            <div className="mt-4 space-y-3">
              <div className="h-4 w-full animate-pulse rounded-md bg-slate-200/70" />
              <div className="h-4 w-5/6 animate-pulse rounded-md bg-slate-200/70" />
              <div className="h-2 w-full animate-pulse rounded-full bg-slate-200/70" />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="h-5 w-40 animate-pulse rounded-md bg-slate-200" />
            <div className="mt-4 space-y-3">
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="h-4 w-2/3 animate-pulse rounded-md bg-slate-200/70" />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {[0, 1].map((card) => (
            <div key={card} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="h-5 w-32 animate-pulse rounded-md bg-slate-200" />
              <div className="mt-4 space-y-3">
                <div className="h-4 w-full animate-pulse rounded-md bg-slate-200/70" />
                <div className="h-4 w-4/5 animate-pulse rounded-md bg-slate-200/70" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
