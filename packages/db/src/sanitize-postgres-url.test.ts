import { describe, expect, it } from "vitest";
import { sanitizePostgresUrl } from "./client.js";

describe("sanitizePostgresUrl", () => {
  it("returns a well-formed URL unchanged", () => {
    const url = "postgres://user:pass@localhost:5432/paperclip";
    expect(sanitizePostgresUrl(url)).toBe(url);
  });

  it("returns a URL with already-encoded password unchanged", () => {
    const url = "postgresql://user:MyPass%40word%23123@myhost:5432/mydb";
    expect(sanitizePostgresUrl(url)).toBe(url);
  });

  it("encodes @ in password", () => {
    const raw = "postgres://myuser:MyPass@word@myhost:5432/mydb";
    const result = sanitizePostgresUrl(raw);
    const parsed = new URL(result);
    expect(parsed.hostname).toBe("myhost");
    expect(parsed.port).toBe("5432");
    expect(parsed.pathname).toBe("/mydb");
    expect(decodeURIComponent(parsed.password)).toBe("MyPass@word");
  });

  it("encodes # in password", () => {
    const raw = "postgres://myuser:pass#123@myhost:5432/mydb";
    const result = sanitizePostgresUrl(raw);
    const parsed = new URL(result);
    expect(parsed.hostname).toBe("myhost");
    expect(decodeURIComponent(parsed.password)).toBe("pass#123");
  });

  it("encodes both @ and # in password", () => {
    const raw = "postgres://myuser:MyPass@word#123@myhost:5432/mydb";
    const result = sanitizePostgresUrl(raw);
    const parsed = new URL(result);
    expect(parsed.hostname).toBe("myhost");
    expect(parsed.port).toBe("5432");
    expect(decodeURIComponent(parsed.password)).toBe("MyPass@word#123");
  });

  it("handles postgresql:// scheme", () => {
    const raw = "postgresql://user:p@ss@host:5432/db";
    const result = sanitizePostgresUrl(raw);
    expect(result.startsWith("postgresql://")).toBe(true);
    const parsed = new URL(result);
    expect(parsed.hostname).toBe("host");
    expect(decodeURIComponent(parsed.password)).toBe("p@ss");
  });

  it("handles password with multiple @ signs", () => {
    const raw = "postgres://admin:p@ss@w@rd@db.example.com:5432/mydb";
    const result = sanitizePostgresUrl(raw);
    const parsed = new URL(result);
    expect(parsed.hostname).toBe("db.example.com");
    expect(decodeURIComponent(parsed.password)).toBe("p@ss@w@rd");
  });

  it("returns non-URL strings unchanged", () => {
    expect(sanitizePostgresUrl("not-a-url")).toBe("not-a-url");
  });

  it("handles URL without credentials", () => {
    const url = "postgres://localhost:5432/mydb";
    expect(sanitizePostgresUrl(url)).toBe(url);
  });

  it("handles URL with query parameters", () => {
    const raw = "postgres://user:p@ss@host:5432/db?sslmode=require";
    const result = sanitizePostgresUrl(raw);
    const parsed = new URL(result);
    expect(parsed.hostname).toBe("host");
    expect(parsed.searchParams.get("sslmode")).toBe("require");
    expect(decodeURIComponent(parsed.password)).toBe("p@ss");
  });

  it("preserves spaces and other special characters", () => {
    const raw = "postgres://user:my pass!word@host:5432/db";
    const result = sanitizePostgresUrl(raw);
    const parsed = new URL(result);
    expect(parsed.hostname).toBe("host");
    expect(decodeURIComponent(parsed.password)).toBe("my pass!word");
  });
});
