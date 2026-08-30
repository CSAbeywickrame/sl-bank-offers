// Site-wide footer with navy background and navy-to-emerald gradient top rule
export function Footer() {
  return (
    <footer className="mt-auto bg-(--surface-inverse)">
      <div
        aria-hidden="true"
        className="h-0.5"
        style={{ background: "linear-gradient(90deg, var(--navy-600), var(--emerald-400) 50%, var(--navy-600))" }}
      />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-sm font-semibold text-(--emerald-300)">
            Sri Lankan Bank Card Offers
          </p>
          <p className="text-xs text-white/55">
            Data sourced from official bank websites · Verify all offers directly with your bank
          </p>
          <p className="text-xs text-white/55">
            &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  );
}
