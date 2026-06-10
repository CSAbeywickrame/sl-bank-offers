import type { Route } from "next";
import Link from "next/link";
import { getBanks } from "@/lib/offers/banks";
import { categories } from "@/lib/offers/categories";

export function BankCategoryNav() {
  const banks = getBanks();

  return (
    <nav className="grid gap-4 md:grid-cols-2" aria-label="Browse offers">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">Banks</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {banks.map((bank) => (
            <Link
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-teal-700 hover:text-teal-800"
              href={`/banks/${bank.id}` as Route}
              key={bank.id}
            >
              {bank.shortName}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500">Categories</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {categories.map((category) => (
            <Link
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-teal-700 hover:text-teal-800"
              href={`/categories/${category.id}` as Route}
              key={category.id}
            >
              {category.label}
            </Link>
          ))}
        </div>
      </section>
    </nav>
  );
}
