import { OfferCard } from "./OfferCard";
import type { Offer } from "@/lib/offers/types";

export function OfferGrid({ offers }: { offers: Offer[] }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {offers.map((offer) => (
        <OfferCard key={offer.id} offer={offer} />
      ))}
    </section>
  );
}
