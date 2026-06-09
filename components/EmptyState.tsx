export function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <h2 className="text-lg font-semibold text-slate-950">No matching offers</h2>
      <p className="mt-2 text-sm text-slate-600">Try another bank, category, or search term.</p>
    </div>
  );
}
