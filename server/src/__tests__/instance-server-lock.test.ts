import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  acquireInstanceServerLock,
  InstanceServerAlreadyRunningError,
} from "../services/instance-server-lock.js";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    process.env[key] = value;
  }
});

describe("instance server lock", () => {
  it("acquires, updates, and releases the per-instance server lock", async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-instance-lock-"));
    process.env.PAPERCLIP_HOME = homeDir;
    process.env.PAPERCLIP_INSTANCE_ID = "lock-test";
    process.env.PAPERCLIP_CONFIG = path.join(homeDir, "instances", "lock-test", "config.json");

    const lock = await acquireInstanceServerLock({
      requestedHost: "127.0.0.1",
      requestedPort: 3100,
    });

    const created = JSON.parse(await fs.readFile(lock.lockPath, "utf8"));
    expect(created.pid).toBe(process.pid);
    expect(created.stage).toBe("starting");

    await lock.markListening({
      host: "127.0.0.1",
      port: 3102,
      apiUrl: "http://127.0.0.1:3102",
    });

    const updated = JSON.parse(await fs.readFile(lock.lockPath, "utf8"));
    expect(updated.stage).toBe("listening");
    expect(updated.listenPort).toBe(3102);
    expect(updated.apiUrl).toBe("http://127.0.0.1:3102");

    await lock.release();
    await expect(fs.access(lock.lockPath)).rejects.toThrow();
  });

  it("reclaims a stale lock left by a dead process", async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-instance-lock-stale-"));
    const instanceRoot = path.join(homeDir, "instances", "stale-lock");
    const lockPath = path.join(instanceRoot, "runtime-services", "instance-server.lock.json");
    await fs.mkdir(path.dirname(lockPath), { recursive: true });
    await fs.writeFile(
      lockPath,
      `${JSON.stringify({
        version: 1,
        pid: 999_999_999,
        instanceId: "stale-lock",
        instanceRoot,
        configPath: path.join(instanceRoot, "config.json"),
        requestedHost: "127.0.0.1",
        requestedPort: 3100,
        listenHost: "127.0.0.1",
        listenPort: 3100,
        apiUrl: "http://127.0.0.1:3100",
        stage: "listening",
        acquiredAt: "2026-04-10T00:00:00.000Z",
        updatedAt: "2026-04-10T00:00:00.000Z",
      }, null, 2)}\n`,
      "utf8",
    );

    process.env.PAPERCLIP_HOME = homeDir;
    process.env.PAPERCLIP_INSTANCE_ID = "stale-lock";
    process.env.PAPERCLIP_CONFIG = path.join(instanceRoot, "config.json");

    const lock = await acquireInstanceServerLock({
      requestedHost: "127.0.0.1",
      requestedPort: 3100,
    });

    const created = JSON.parse(await fs.readFile(lock.lockPath, "utf8"));
    expect(created.pid).toBe(process.pid);
    expect(created.instanceId).toBe("stale-lock");

    await lock.release();
  });

  it("fails fast when the same instance is already owned by a live process", async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-instance-lock-live-"));
    const instanceRoot = path.join(homeDir, "instances", "live-lock");
    const lockPath = path.join(instanceRoot, "runtime-services", "instance-server.lock.json");
    await fs.mkdir(path.dirname(lockPath), { recursive: true });
    await fs.writeFile(
      lockPath,
      `${JSON.stringify({
        version: 1,
        pid: process.pid,
        instanceId: "live-lock",
        instanceRoot,
        configPath: path.join(instanceRoot, "config.json"),
        requestedHost: "127.0.0.1",
        requestedPort: 3100,
        listenHost: "127.0.0.1",
        listenPort: 3100,
        apiUrl: "http://127.0.0.1:3100",
        stage: "listening",
        acquiredAt: "2026-04-10T00:00:00.000Z",
        updatedAt: "2026-04-10T00:00:00.000Z",
      }, null, 2)}\n`,
      "utf8",
    );

    process.env.PAPERCLIP_HOME = homeDir;
    process.env.PAPERCLIP_INSTANCE_ID = "live-lock";
    process.env.PAPERCLIP_CONFIG = path.join(instanceRoot, "config.json");

    await expect(
      acquireInstanceServerLock({
        requestedHost: "127.0.0.1",
        requestedPort: 3100,
      }),
    ).rejects.toBeInstanceOf(InstanceServerAlreadyRunningError);
  });
});
