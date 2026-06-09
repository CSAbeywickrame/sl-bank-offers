import { getBankById } from "@/lib/offers/banks";
import { getCardsByBankId } from "@/lib/offers/cards";
import { banks } from "@/lib/offers/banks";
import { categories } from "@/lib/offers/categories";
import type { OfferCategory } from "@/lib/offers/types";

interface FilterPanelProps {
  selectedBankId?: string;
  selectedCardId?: string;
  selectedCategory?: OfferCategory;
  search?: string;
  actionPath?: string;
}

export function FilterPanel({ selectedBankId = "", selectedCardId = "", selectedCategory, search = "", actionPath = "/" }: FilterPanelProps) {
  const availableCards = getCardsByBankId(selectedBankId);

  return (
    <form action={actionPath} className="border-y border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-3 px-4 py-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_2fr_auto]">
        <div className="grid gap-1 text-sm font-medium text-slate-700">
          <label htmlFor="offer-bank-filter">Bank</label>
          <select
            id="offer-bank-filter"
            name="bank"
            defaultValue={selectedBankId}
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950"
          >
            <option value="">All banks</option>
            {banks.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.shortName}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1 text-sm font-medium text-slate-700">
          <label htmlFor="offer-card-filter">Card</label>
          <select
            id="offer-card-filter"
            name="card"
            defaultValue={selectedCardId}
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950"
          >
            <option value="">All cards</option>
            {availableCards.map((card) => {
              const bank = getBankById(card.bankId);
              const bankLabel = selectedBankId ? "" : `${bank?.shortName ?? card.bankId} · `;

              return (
                <option key={card.id} value={card.id}>
                  {bankLabel}
                  {card.name}
                </option>
              );
            })}
          </select>
        </div>

        <div className="grid gap-1 text-sm font-medium text-slate-700">
          <label htmlFor="offer-category-filter">Category</label>
          <select
            id="offer-category-filter"
            name="category"
            defaultValue={selectedCategory ?? ""}
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1 text-sm font-medium text-slate-700">
          <label htmlFor="offer-search-filter">Search</label>
          <input
            id="offer-search-filter"
            name="search"
            defaultValue={search}
            placeholder="Merchant, bank, offer"
            className="h-11 rounded-md border border-slate-300 px-3 text-sm text-slate-950"
          />
        </div>

        <div className="flex items-end">
          <button className="h-11 w-full rounded-md bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800" type="submit">
            Filter
          </button>
        </div>
      </div>
    </form>
  );
}
