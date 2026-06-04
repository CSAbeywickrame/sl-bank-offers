import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Offer } from "./types";

const dataPath = path.join(process.cwd(), "data", "offers.json");

export async function getAllOffers(): Promise<Offer[]> {
  const raw = await readFile(dataPath, "utf8");
  return JSON.parse(raw) as Offer[];
}

export async function getActiveOffers(): Promise<Offer[]> {
  const offers = await getAllOffers();
  return offers.filter((offer) => offer.status === "auto_published");
}
