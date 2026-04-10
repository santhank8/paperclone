import { HttpError } from "../errors.js";

const NON_INVOKABLE_STATUSES = new Set(["paused", "terminated", "pending_approval"]);

function readErrorStatusDetail(error: HttpError) {
  if (!error.details || typeof error.details !== "object") return null;
  const status = (error.details as Record<string, unknown>).status;
  return typeof status === "string" ? status : null;
}

export function isAgentNotInvokableWakeupError(error: unknown) {
  if (!(error instanceof HttpError) || error.status !== 409) return false;
  if (error.message === "Agent is not invokable in its current state") return true;
  const detailStatus = readErrorStatusDetail(error);
  return detailStatus !== null && NON_INVOKABLE_STATUSES.has(detailStatus);
}

export function getAgentNotInvokableStatus(error: unknown) {
  if (!(error instanceof HttpError) || error.status !== 409) return null;
  const detailStatus = readErrorStatusDetail(error);
  return detailStatus !== null && NON_INVOKABLE_STATUSES.has(detailStatus) ? detailStatus : null;
}
