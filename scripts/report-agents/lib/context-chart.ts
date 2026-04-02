// context-chart.ts
// Generate topic-specific HTML report → render to PNG via Puppeteer
// Replaces QuickChart.io with rich dark-theme HTML + Chart.js

import Database from "better-sqlite3";
import { basename } from "path";
import { buildContextReportHtml } from "./html-report-builder.js";
import { renderReportToPng } from "./report-html.js";

function detectTopic(reportPath: string): string {
  const name = basename(reportPath, ".md");
  return name.replace(/^\d{4}-\d{2}-\d{2}-/, "");
}

export async function generateContextChart(
  reportPath: string,
  dbPath: string
): Promise<Buffer> {
  const topic = detectTopic(reportPath);
  const db = new Database(dbPath, { readonly: true });

  try {
    const html = buildContextReportHtml(topic, db);
    return await renderReportToPng(html);
  } finally {
    db.close();
  }
}
