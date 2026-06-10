export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-sm font-medium text-slate-300">Sri Lankan Bank Card Offers</p>
          <p className="text-xs text-slate-500">
            Data sourced from official bank websites &middot; Verify all offers directly with your bank
          </p>
          <p className="text-xs text-slate-500">&copy; {new Date().getFullYear()}</p>
        </div>
      </div>
    </footer>
  );
}
