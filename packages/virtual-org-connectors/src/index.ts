import type { VirtualOrgConnectorKind } from "@paperclipai/virtual-org-types";

export const CONNECTOR_LABELS: Record<VirtualOrgConnectorKind, string> = {
  slack: "Slack",
  manual_capture: "Manual Capture",
  product_analytics: "Product Analytics",
  marketing_analytics: "Marketing Analytics",
  website_analytics: "Website Analytics",
  competitor_monitoring: "Competitor Monitoring",
  internal_database: "Internal Database",
  xero: "Xero",
  stripe: "Stripe",
  posthog: "PostHog",
  hubspot: "HubSpot",
  intercom: "Intercom",
  google_analytics: "Google Analytics",
  search_console: "Search Console",
  tempa: "Tempa",
  website_crawler: "Website Crawler",
  help_center_crawler: "Help Center Crawler",
};

export function connectorLabel(kind: VirtualOrgConnectorKind): string {
  return CONNECTOR_LABELS[kind];
}

export * from "./officely.js";
