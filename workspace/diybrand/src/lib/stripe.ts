import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-02-25.clover",
    });
  }
  return _stripe;
}

export const TIERS = {
  basic: {
    name: "Basic Brand Kit",
    price: 1900, // cents
    description: "Logos (PNG) + color palette + typography guide",
  },
  premium: {
    name: "Premium Brand Kit",
    price: 4900, // cents
    description:
      "Everything in Basic + social media templates + business card mockup",
  },
} as const;

export type Tier = keyof typeof TIERS;
