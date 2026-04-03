import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../errors.js";
import { blogPublisherService, type UploadedMediaInput } from "../services/blog-publisher.ts";

type ExecutionRow = {
  id: string;
  publishIdempotencyKey: string;
  resultJson: Record<string, unknown> | null;
};

function createDbStub(existingExecution: ExecutionRow | null = null) {
  const selectWhere = vi.fn(async () => (existingExecution ? [existingExecution] : []));
  const from = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from }));

  const returning = vi.fn(async () => ([{
    id: "exec-1",
    publishIdempotencyKey: "idem-1",
    resultJson: { id: 321, link: "https://fluxaivory.com/test-post/" },
  }]));
  const values = vi.fn(() => ({ returning }));
  const insert = vi.fn(() => ({ values }));

  return {
    db: {
      select,
      insert,
    },
    selectWhere,
    values,
  };
}

function createJsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

describe("blogPublisherService", () => {
  let fetchImpl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchImpl = vi.fn();
  });

  it("rejects localhost WordPress API targets", async () => {
    const { db } = createDbStub();
    const service = blogPublisherService(db as any, {
      fetchImpl,
      env: {
        WP_API_URL: "http://localhost:8080/wp-json/wp/v2",
        WP_USER: "localadmin",
        WP_APP_PASSWORD: "app-pass",
      },
    });

    await expect(
      service.publishDraft({
        blogRunId: "run-1",
        companyId: "company-1",
        approvalId: "approval-1",
        publishIdempotencyKey: "idem-1",
        siteId: "fluxaivory.com",
        title: "Draft title",
        content: "<p>Draft body</p>",
        targetSlug: "draft-title",
      }),
    ).rejects.toMatchObject<HttpError>({
      status: 422,
      message: "wp_api_url_forbidden:http://localhost:8080/wp-json/wp/v2",
    });
  });

  it("requires WordPress credentials", async () => {
    const { db } = createDbStub();
    const service = blogPublisherService(db as any, {
      fetchImpl,
      env: {
        WP_API_URL: "https://fluxaivory.com/wp-json/wp/v2",
        WP_USER: "",
        WP_APP_PASSWORD: "",
      },
    });

    await expect(
      service.publishDraft({
        blogRunId: "run-1",
        companyId: "company-1",
        approvalId: "approval-1",
        publishIdempotencyKey: "idem-1",
        siteId: "fluxaivory.com",
        title: "Draft title",
        content: "<p>Draft body</p>",
      }),
    ).rejects.toMatchObject<HttpError>({
      status: 422,
      message: "WordPress credentials are required",
    });
  });

  it("publishes a draft and stores a publish execution row", async () => {
    const { db, values } = createDbStub();
    fetchImpl
      .mockResolvedValueOnce(createJsonResponse(200, { id: 7, name: "Local Admin", slug: "localadmin" }))
      .mockResolvedValueOnce(createJsonResponse(201, { id: 321, status: "draft", link: "https://fluxaivory.com/test-post/" }));

    const service = blogPublisherService(db as any, {
      fetchImpl,
      env: {
        WP_API_URL: "https://fluxaivory.com/wp-json/wp/v2",
        WP_USER: "localadmin",
        WP_APP_PASSWORD: "app-pass",
      },
    });

    const result = await service.publishDraft({
      blogRunId: "run-1",
      companyId: "company-1",
      approvalId: "approval-1",
      publishIdempotencyKey: "idem-1",
      siteId: "fluxaivory.com",
      title: "Draft title",
      content: "<p>Draft body</p>",
      targetSlug: "draft-title",
      categoryIds: [42],
    });

    expect(result.reusedExecution).toBe(false);
    expect(result.authenticatedUser).toBe("Local Admin");
    expect(result.post).toMatchObject({ id: 321, status: "draft" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      blogRunId: "run-1",
      companyId: "company-1",
      approvalId: "approval-1",
      publishIdempotencyKey: "idem-1",
      wordpressPostId: 321,
      publishedUrl: "https://fluxaivory.com/test-post/",
    }));
  });

  it("uploads featured and supporting media for a publish run", async () => {
    const { db } = createDbStub();
    fetchImpl
      .mockResolvedValueOnce(createJsonResponse(200, { id: 7, name: "Local Admin", slug: "localadmin" }))
      .mockResolvedValueOnce(createJsonResponse(201, { id: 321, status: "publish", link: "https://fluxaivory.com/test-post/" }))
      .mockResolvedValueOnce(createJsonResponse(201, { id: 77, source_url: "https://fluxaivory.com/wp-content/uploads/featured.png", mime_type: "image/png" }))
      .mockResolvedValueOnce(createJsonResponse(200, { id: 321, featured_media: 77 }))
      .mockResolvedValueOnce(createJsonResponse(201, { id: 88, source_url: "https://fluxaivory.com/wp-content/uploads/support-1.png", mime_type: "image/png" }))
      .mockResolvedValueOnce(createJsonResponse(200, { id: 321, status: "publish", link: "https://fluxaivory.com/test-post/" }));

    const service = blogPublisherService(db as any, {
      fetchImpl,
      env: {
        PUBLISH_WP_API_URL: "https://fluxaivory.com/wp-json/wp/v2",
        PUBLISH_WP_USER: "publisher",
        PUBLISH_WP_APP_PASSWORD: "publish-pass",
      },
    });

    const image: UploadedMediaInput = {
      filename: "featured.png",
      mimeType: "image/png",
      body: Buffer.from("featured"),
    };
    const support: UploadedMediaInput = {
      filename: "support-1.png",
      mimeType: "image/png",
      body: Buffer.from("support"),
    };

    const result = await service.publishPost({
      blogRunId: "run-2",
      companyId: "company-1",
      approvalId: "approval-2",
      publishIdempotencyKey: "idem-2",
      siteId: "fluxaivory.com",
      title: "Publish title",
      content: "<p>Publish body</p>",
      targetSlug: "publish-title",
      featuredMedia: image,
      supportingMedia: [support],
    });

    expect(result.post).toMatchObject({ id: 321, status: "publish" });
    expect(result.featuredMedia).toMatchObject({ mediaId: 77, postFeaturedMedia: 77 });
    expect(result.supportingMedia).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });

  it("reuses an existing execution for the same idempotency key", async () => {
    const existing = {
      id: "exec-existing",
      publishIdempotencyKey: "idem-existing",
      resultJson: { id: 999, link: "https://fluxaivory.com/existing/" },
    };
    const { db } = createDbStub(existing);
    const service = blogPublisherService(db as any, {
      fetchImpl,
      env: {
        WP_API_URL: "https://fluxaivory.com/wp-json/wp/v2",
        WP_USER: "localadmin",
        WP_APP_PASSWORD: "app-pass",
      },
    });

    const result = await service.publishDraft({
      blogRunId: "run-3",
      companyId: "company-1",
      approvalId: "approval-3",
      publishIdempotencyKey: "idem-existing",
      siteId: "fluxaivory.com",
      title: "Existing title",
      content: "<p>Existing body</p>",
    });

    expect(result.reusedExecution).toBe(true);
    expect(result.execution).toMatchObject(existing);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("requires approval and idempotency metadata", async () => {
    const { db } = createDbStub();
    const service = blogPublisherService(db as any, {
      fetchImpl,
      env: {
        WP_API_URL: "https://fluxaivory.com/wp-json/wp/v2",
        WP_USER: "localadmin",
        WP_APP_PASSWORD: "app-pass",
      },
    });

    await expect(
      service.publishDraft({
        blogRunId: "run-4",
        companyId: "company-1",
        approvalId: "",
        publishIdempotencyKey: "idem-4",
        siteId: "fluxaivory.com",
        title: "Missing approval",
        content: "<p>Missing approval</p>",
      }),
    ).rejects.toMatchObject<HttpError>({
      status: 422,
      message: "Publish approval is required",
    });

    await expect(
      service.publishDraft({
        blogRunId: "run-4",
        companyId: "company-1",
        approvalId: "approval-4",
        publishIdempotencyKey: "",
        siteId: "fluxaivory.com",
        title: "Missing idempotency",
        content: "<p>Missing idempotency</p>",
      }),
    ).rejects.toMatchObject<HttpError>({
      status: 422,
      message: "Publish idempotency key is required",
    });
  });
});
