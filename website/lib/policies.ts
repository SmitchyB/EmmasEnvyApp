import type { SiteSettings } from "@emmasenvy/shared";

export interface PolicyPage {
  slug: string;
  title: string;
  field: keyof Pick<
    SiteSettings,
    | "policy_privacy"
    | "policy_appointment_cancellation"
    | "policy_service_guarantee_fix"
    | "policy_shipping_fulfillment"
    | "policy_rewards_loyalty"
  >;
}

export const POLICY_PAGES: PolicyPage[] = [
  { slug: "privacy", title: "Privacy Policy", field: "policy_privacy" },
  {
    slug: "cancellation",
    title: "Appointment Cancellation",
    field: "policy_appointment_cancellation",
  },
  {
    slug: "service-guarantee",
    title: "Service Guarantee",
    field: "policy_service_guarantee_fix",
  },
  {
    slug: "shipping",
    title: "Shipping & Fulfillment",
    field: "policy_shipping_fulfillment",
  },
  {
    slug: "rewards",
    title: "Rewards & Loyalty",
    field: "policy_rewards_loyalty",
  },
];

export function getPolicyBySlug(slug: string): PolicyPage | undefined {
  return POLICY_PAGES.find((p) => p.slug === slug);
}
