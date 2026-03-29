type CheckoutWakeInput = {
  actorType: "board" | "agent" | "none";
  actorAgentId: string | null;
  checkoutAgentId: string;
  checkoutRunId: string | null;
};

export function shouldWakeAssigneeOnCheckout(input: CheckoutWakeInput): boolean {
  const normalizedActorAgentId = typeof input.actorAgentId === "string"
    ? input.actorAgentId.trim().toLowerCase()
    : null;
  const normalizedCheckoutAgentId = typeof input.checkoutAgentId === "string"
    ? input.checkoutAgentId.trim().toLowerCase()
    : "";
  const normalizedCheckoutRunId = typeof input.checkoutRunId === "string"
    ? input.checkoutRunId.trim()
    : null;

  if (input.actorType !== "agent") return true;
  if (!normalizedActorAgentId) return true;
  if (!normalizedCheckoutAgentId) return true;
  if (normalizedActorAgentId !== normalizedCheckoutAgentId) return true;
  if (!normalizedCheckoutRunId) return true;
  return false;
}
