"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
            <p className="mt-4 text-sm text-gray-500">Loading...</p>
          </div>
        </main>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [state, setState] = useState<
    "loading" | "paid" | "error"
  >("loading");
  const [data, setData] = useState<{
    tier: string;
    questionnaireId: string;
  } | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setState("error");
      return;
    }

    fetch(`/api/checkout/verify?session_id=${sessionId}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.paid) {
          setData({ tier: json.tier, questionnaireId: json.questionnaireId });
          setState("paid");
        } else {
          setState("error");
        }
      })
      .catch(() => setState("error"));
  }, [sessionId]);

  async function handleDownload() {
    if (!data || !sessionId) return;
    setDownloading(true);
    try {
      const res = await fetch(
        `/api/export/brand-kit/${data.questionnaireId}?session_id=${sessionId}`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="(.+)"/)?.[1] || "brand-kit.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Error handled silently — user can retry
    } finally {
      setDownloading(false);
    }
  }

  if (state === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
          <p className="mt-4 text-sm text-gray-500">
            Verifying your payment...
          </p>
        </div>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-8 w-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-bold text-gray-900">
            Payment not confirmed
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            We couldn&apos;t verify your payment. If you were charged, please
            contact support.
          </p>
          <a
            href="/"
            className="mt-6 inline-block text-sm text-violet-600 underline hover:text-violet-700"
          >
            Back to home
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <svg
            className="h-8 w-8 text-emerald-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        </div>
        <h1 className="mt-4 text-xl font-bold text-gray-900">
          Payment successful!
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Your {data?.tier === "premium" ? "Premium" : "Basic"} Brand Kit is
          ready to download.
        </p>

        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-8 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {downloading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Preparing...
            </>
          ) : (
            <>
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
              Download Brand Kit
            </>
          )}
        </button>

        <div className="mt-6">
          <a
            href="/"
            className="text-sm text-gray-500 underline hover:text-gray-700"
          >
            Back to home
          </a>
        </div>
      </div>
    </main>
  );
}
