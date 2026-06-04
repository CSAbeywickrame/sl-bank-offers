import { banks } from "@/lib/offers/banks";
import { categories } from "@/lib/offers/categories";
import type { OfferCategory } from "@/lib/offers/types";

interface FilterPanelProps {
  selectedBankId?: string;
  selectedCategory?: OfferCategory;
  search?: string;
  actionPath?: string;
}

export function FilterPanel({ selectedBankId = "", selectedCategory, search = "", actionPath = "/" }: FilterPanelProps) {
  return (
    <form action={actionPath} className="border-y border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-3 px-4 py-4 md:grid-cols-[1fr_1fr_2fr_auto]">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Bank
          <select name="bank" defaultValue={selectedBankId} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950">
            <option value="">All banks</option>
            {banks.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.shortName}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Category
          <select name="category" defaultValue={selectedCategory ?? ""} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950">
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Search
          <input
            name="search"
            defaultValue={search}
            placeholder="Merchant, bank, offer"
            className="h-11 rounded-md border border-slate-300 px-3 text-sm text-slate-950"
          />
        </label>

        <div className="flex items-end">
          <button className="h-11 w-full rounded-md bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800" type="submit">
            Filter
          </button>
        </div>
      </div>
    </form>
  );
}
