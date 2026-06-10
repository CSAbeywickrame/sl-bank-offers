import type { Route } from "next";
import Link from "next/link";
import { getBanks } from "@/lib/offers/banks";
import { categories } from "@/lib/offers/categories";

export function BankCategoryNav() {
  const banks = getBanks();

  return (
    <nav className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Browse offers">
      <div className="grid gap-5 md:grid-cols-2">
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Browse by Bank</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {banks.map((bank) => (
              <Link
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 transition-colors duration-100"
                href={`/banks/${bank.id}` as Route}
                key={bank.id}
              >
                {bank.shortName}
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Browse by Category</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((category) => (
              <Link
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 transition-colors duration-100"
                href={`/categories/${category.id}` as Route}
                key={category.id}
              >
                {category.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </nav>
  );
}
