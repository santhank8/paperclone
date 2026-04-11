import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const LEGACY_PUBLISH_GATEWAY_PATH = "/Users/daehan/ec2-migration/home-ubuntu/board-app/lib/publish-gateway.js";

type PublishGatewayModule = {
  createPublishApproval: (...args: unknown[]) => Promise<unknown>;
  buildPublishIdempotencyKey: (input: Record<string, unknown>) => string;
  executePublishGateway: (...args: unknown[]) => Promise<unknown>;
  executeWritingBoardPublishGateway: (...args: unknown[]) => Promise<unknown>;
};

function getPublishGatewayModule(): PublishGatewayModule {
  return require(LEGACY_PUBLISH_GATEWAY_PATH) as PublishGatewayModule;
}

export async function createPublishApproval(...args: unknown[]): Promise<unknown> {
  return getPublishGatewayModule().createPublishApproval(...args);
}

export function buildPublishIdempotencyKey(input: Record<string, unknown>): string {
  return getPublishGatewayModule().buildPublishIdempotencyKey(input);
}

export async function executePublishGateway(...args: unknown[]): Promise<unknown> {
  return getPublishGatewayModule().executePublishGateway(...args);
}

export async function executeWritingBoardPublishGateway(...args: unknown[]): Promise<unknown> {
  return getPublishGatewayModule().executeWritingBoardPublishGateway(...args);
}
