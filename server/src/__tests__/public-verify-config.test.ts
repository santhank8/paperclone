import { describe, expect, it } from "vitest";
import { resolveWpConfigForPublicVerify } from "../../../packages/blog-pipeline-core/src/adapters/public-verify.ts";

describe("public verify wp config", () => {
  it("prefers publish wordpress credentials over default wordpress credentials", () => {
    const config = resolveWpConfigForPublicVerify({
      WP_API_URL: "https://default.example/wp-json/wp/v2",
      WP_USER: "default-user",
      WP_APP_PASSWORD: "default-pass",
      PUBLISH_WP_API_URL: "https://publish.example/wp-json/wp/v2",
      PUBLISH_WP_USER: "publish-user",
      PUBLISH_WP_APP_PASSWORD: "publish-pass",
    } as NodeJS.ProcessEnv);

    expect(config).toEqual({
      apiUrl: "https://publish.example/wp-json/wp/v2",
      user: "publish-user",
      password: "publish-pass",
    });
  });
});
