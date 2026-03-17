// ui/src/lib/embed-auth.ts
import { setEmbedToken } from "../api/client";

// --- Types ---

export type EmbedAuthMessage =
  | { type: "BUCKGURU_OPERATIONS_AUTH"; token: string }
  | { type: "BUCKGURU_OPERATIONS_TOKEN_REFRESH"; token: string };

type EmbedAuthState = {
  authenticated: boolean;
  user: { id: string; email: string; name: string } | null;
};

type EmbedAuthListener = (state: EmbedAuthState) => void;

// --- Helpers ---

export function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function parseEmbedMessage(data: unknown): EmbedAuthMessage | null {
  if (!data || typeof data !== "object") return null;
  const msg = data as Record<string, unknown>;
  if (typeof msg.type !== "string") return null;
  if (typeof msg.token !== "string") return null;

  if (msg.type === "BUCKGURU_OPERATIONS_AUTH") {
    return { type: "BUCKGURU_OPERATIONS_AUTH", token: msg.token };
  }
  if (msg.type === "BUCKGURU_OPERATIONS_TOKEN_REFRESH") {
    return { type: "BUCKGURU_OPERATIONS_TOKEN_REFRESH", token: msg.token };
  }
  return null;
}

// --- Token exchange ---

async function exchangeToken(
  buckguruJwt: string,
): Promise<{ embedToken: string; user: { id: string; email: string; name: string } } | null> {
  try {
    const res = await fetch("/api/auth/embed", {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: buckguruJwt }),
    });
    if (!res.ok) {
      console.error(`[embed-auth] Token exchange failed: ${res.status}`);
      return null;
    }
    return res.json();
  } catch (err) {
    console.error("[embed-auth] Token exchange error:", err);
    return null;
  }
}

// --- Signals to parent ---

function sendToParent(type: string, extra?: Record<string, unknown>) {
  const origin = trustedParentOrigin ?? "*";
  if (origin === "*") {
    console.warn("[embed-auth] sendToParent using '*' — trustedParentOrigin not yet set");
  }
  try {
    window.parent.postMessage({ type, ...extra }, origin);
  } catch {
    // Silently ignore if parent is inaccessible
  }
}

export function sendReady() {
  sendToParent("PAPERCLIP_READY");
}

export function sendTokenExpired() {
  sendToParent("PAPERCLIP_TOKEN_EXPIRED");
}

// --- Main embed auth controller ---

let initialized = false;
let listeners: EmbedAuthListener[] = [];
let trustedParentOrigin: string | null = null;
let currentState: EmbedAuthState = { authenticated: false, user: null };

function notifyListeners() {
  for (const listener of listeners) {
    listener(currentState);
  }
}

async function handleBuckguruToken(buckguruJwt: string): Promise<boolean> {
  const result = await exchangeToken(buckguruJwt);
  if (!result) {
    currentState = { authenticated: false, user: null };
    setEmbedToken(null);
    notifyListeners();
    return false;
  }

  setEmbedToken(result.embedToken);
  currentState = { authenticated: true, user: result.user };
  notifyListeners();
  return true;
}

export function setTrustedParentOrigin(origin: string) {
  trustedParentOrigin = origin;
}

export function initEmbedAuth(): () => void {
  if (initialized) return () => {};
  initialized = true;

  const handler = async (event: MessageEvent) => {
    if (trustedParentOrigin && event.origin !== trustedParentOrigin) {
      return;
    }

    const msg = parseEmbedMessage(event.data);
    if (!msg) return;

    if (!trustedParentOrigin) {
      trustedParentOrigin = event.origin;
    }

    if (msg.type === "BUCKGURU_OPERATIONS_AUTH") {
      const ok = await handleBuckguruToken(msg.token);
      if (ok) {
        sendReady();
      }
    }

    if (msg.type === "BUCKGURU_OPERATIONS_TOKEN_REFRESH") {
      const ok = await handleBuckguruToken(msg.token);
      if (!ok) {
        sendTokenExpired();
      }
    }
  };

  window.addEventListener("message", handler);

  return () => {
    window.removeEventListener("message", handler);
    initialized = false;
  };
}

export function onEmbedAuthChange(listener: EmbedAuthListener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function getEmbedAuthState(): EmbedAuthState {
  return currentState;
}
