export interface CreditPack {
  id: string;
  credits: number;
  priceINR: number; // in INR rupees
  priceUSD: number; // in USD dollars
  title: string;
  description: string;
  badge?: string;
  popular?: boolean;
}

/**
 * One credit = one full live interview round (all phases in the state machine,
 * from INTRO through ROUND_COMPLETE, for a single round).
 */
export const CREDIT_PACKS: readonly CreditPack[] = [
  {
    id: "pack_5",
    credits: 5,
    priceINR: 199,
    priceUSD: 3.99,
    title: "5 Live Interviews",
    description: "Ideal for a quick brush up on target company rounds with real-time web research.",
  },
  {
    id: "pack_15",
    credits: 15,
    priceINR: 499,
    priceUSD: 8.99,
    title: "15 Live Interviews",
    description: "Most popular for candidates preparing for 2-3 company interview loops.",
    badge: "Most Popular",
    popular: true,
  },
  {
    id: "pack_40",
    credits: 40,
    priceINR: 999,
    priceUSD: 14.99,
    title: "40 Live Interviews",
    description: "Full preparation across complex multi-round loops with comprehensive dossiers.",
    badge: "Best Value",
  },
] as const;

export function getCreditPackById(packId: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === packId);
}
