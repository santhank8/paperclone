// context-chart.ts
// Generate topic-specific chart PNG from report .md + SQLite data
// Uses QuickChart.io (same as charts.ts) — no extra dependencies

import { generateChart } from "./charts.js";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { basename } from "path";

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
    if (topic.startsWith("top-tokens") || topic === "volume") {
      return await tokenVolumeChart(db);
    } else if (topic.startsWith("token-")) {
      const symbol = topic.replace("token-", "").toUpperCase();
      return await singleTokenChart(db, symbol);
    } else if (topic === "users" || topic === "traders") {
      return await usersChart(db);
    } else if (topic === "trend") {
      return await trendChart(db);
    } else if (topic === "settle" || topic === "settlement") {
      return await settlementChart(db);
    } else if (topic === "mom") {
      return await momChart(db);
    } else {
      return await tokenVolumeChart(db);
    }
  } finally {
    db.close();
  }
}

async function tokenVolumeChart(db: Database.Database): Promise<Buffer> {
  const rows = db.prepare(`
    SELECT token_symbol AS symbol,
      ROUND(SUM(order_value_usd_1side) * 2, 0) AS volume
    FROM _order_flat
    GROUP BY token_symbol
    ORDER BY volume DESC
    LIMIT 10
  `).all() as Array<{ symbol: string; volume: number }>;

  return generateChart({
    type: "horizontalBar",
    data: {
      labels: rows.map(r => `$${r.symbol}`),
      datasets: [{
        label: "Filled Volume 2-sided (USD)",
        data: rows.map(r => r.volume),
        backgroundColor: "rgba(54, 162, 235, 0.8)",
        borderColor: "rgba(54, 162, 235, 1)",
        borderWidth: 1,
      }],
    },
    options: {
      title: { display: true, text: "Top 10 Tokens by Filled Volume (All-time, 2-sided)", fontSize: 14 },
      scales: { xAxes: [{ ticks: { beginAtZero: true } }] },
    },
  }, 700, 400);
}

async function singleTokenChart(db: Database.Database, symbol: string): Promise<Buffer> {
  const trend = db.prepare(`
    SELECT DATE(created_at) AS date,
      ROUND(SUM(order_value_usd_1side) * 2, 0) AS volume,
      COUNT(DISTINCT order_id) AS orders
    FROM _order_flat
    WHERE token_symbol = ?
    GROUP BY DATE(created_at)
    ORDER BY date
  `).all(symbol) as Array<{ date: string; volume: number; orders: number }>;

  return generateChart({
    type: "line",
    data: {
      labels: trend.map(d => d.date.slice(5)),
      datasets: [
        {
          label: "Volume (USD)",
          data: trend.map(d => d.volume),
          borderColor: "rgba(54, 162, 235, 1)",
          backgroundColor: "rgba(54, 162, 235, 0.1)",
          fill: true,
          borderWidth: 2,
        },
        {
          label: "Orders",
          data: trend.map(d => d.orders),
          borderColor: "rgba(255, 99, 132, 1)",
          fill: false,
          borderWidth: 2,
        },
      ],
    },
    options: {
      title: { display: true, text: `$${symbol} — Daily Volume & Orders`, fontSize: 14 },
    },
  }, 700, 400);
}

async function usersChart(db: Database.Database): Promise<Buffer> {
  const rows = db.prepare(`
    WITH w AS (
      SELECT DISTINCT token_symbol, buyer_id AS uid FROM _order_flat WHERE created_at >= datetime('now', '-7 days')
      UNION SELECT DISTINCT token_symbol, seller_id FROM _order_flat WHERE created_at >= datetime('now', '-7 days')
    )
    SELECT w.token_symbol AS symbol,
      COUNT(DISTINCT CASE WHEN ufo.first_order_at >= datetime('now', '-7 days') THEN w.uid END) AS new_users,
      COUNT(DISTINCT CASE WHEN ufo.first_order_at < datetime('now', '-7 days') THEN w.uid END) AS returning
    FROM w JOIN _user_first_order ufo ON w.uid = ufo.user_id
    GROUP BY w.token_symbol
    ORDER BY (new_users + returning) DESC
    LIMIT 8
  `).all() as Array<{ symbol: string; new_users: number; returning: number }>;

  return generateChart({
    type: "bar",
    data: {
      labels: rows.map(r => `$${r.symbol}`),
      datasets: [
        { label: "New", data: rows.map(r => r.new_users), backgroundColor: "rgba(75, 192, 192, 0.8)" },
        { label: "Returning", data: rows.map(r => r.returning), backgroundColor: "rgba(153, 102, 255, 0.8)" },
      ],
    },
    options: {
      title: { display: true, text: "New vs Returning Traders (7d)", fontSize: 14 },
      scales: { xAxes: [{ stacked: true }], yAxes: [{ stacked: true }] },
    },
  }, 700, 400);
}

async function trendChart(db: Database.Database): Promise<Buffer> {
  const rows = db.prepare(`
    SELECT DATE(created_at) AS date,
      ROUND(SUM(order_value_usd_1side) * 2, 0) AS volume,
      COUNT(DISTINCT order_id) AS orders
    FROM _order_flat
    WHERE created_at >= datetime('now', '-14 days')
    GROUP BY DATE(created_at)
    ORDER BY date
  `).all() as Array<{ date: string; volume: number; orders: number }>;

  return generateChart({
    type: "line",
    data: {
      labels: rows.map(d => d.date.slice(5)),
      datasets: [{
        label: "Volume 2-sided (USD)",
        data: rows.map(d => d.volume),
        borderColor: "rgba(54, 162, 235, 1)",
        backgroundColor: "rgba(54, 162, 235, 0.1)",
        fill: true,
        borderWidth: 2,
      }],
    },
    options: {
      title: { display: true, text: "Daily Volume Trend (14d, 2-sided)", fontSize: 14 },
      scales: { yAxes: [{ ticks: { beginAtZero: true } }] },
    },
  }, 700, 400);
}

async function settlementChart(db: Database.Database): Promise<Buffer> {
  const rows = db.prepare(`
    SELECT token_symbol AS symbol,
      ROUND(COUNT(DISTINCT CASE WHEN status = 'close' THEN order_id END) * 100.0 /
        NULLIF(COUNT(DISTINCT CASE WHEN status IN ('close','cancel') THEN order_id END), 0), 1) AS rate,
      COUNT(DISTINCT order_id) AS total
    FROM _order_flat
    GROUP BY token_symbol
    HAVING total >= 50
    ORDER BY rate ASC
    LIMIT 10
  `).all() as Array<{ symbol: string; rate: number; total: number }>;

  return generateChart({
    type: "horizontalBar",
    data: {
      labels: rows.map(r => `$${r.symbol}`),
      datasets: [{
        label: "Settlement Rate %",
        data: rows.map(r => r.rate),
        backgroundColor: rows.map(r =>
          r.rate >= 80 ? "rgba(74, 222, 128, 0.8)" :
          r.rate >= 50 ? "rgba(250, 204, 21, 0.8)" :
          "rgba(248, 113, 113, 0.8)"
        ),
        borderWidth: 1,
      }],
    },
    options: {
      title: { display: true, text: "Settlement Rate by Token (incl. exit positions)", fontSize: 14 },
      scales: { xAxes: [{ ticks: { min: 0, max: 100 } }] },
    },
  }, 700, 400);
}

async function momChart(db: Database.Database): Promise<Buffer> {
  const rows = db.prepare(`
    SELECT strftime('%Y-%m', created_at) AS month,
      ROUND(SUM(order_value_usd_1side) * 2, 0) AS volume,
      COUNT(DISTINCT order_id) AS orders
    FROM _order_flat
    WHERE created_at >= datetime('now', '-6 months')
    GROUP BY month
    ORDER BY month
  `).all() as Array<{ month: string; volume: number; orders: number }>;

  return generateChart({
    type: "bar",
    data: {
      labels: rows.map(r => r.month),
      datasets: [
        { label: "Volume (USD)", data: rows.map(r => r.volume), backgroundColor: "rgba(54, 162, 235, 0.8)" },
      ],
    },
    options: {
      title: { display: true, text: "Monthly Volume (2-sided)", fontSize: 14 },
      scales: { yAxes: [{ ticks: { beginAtZero: true } }] },
    },
  }, 700, 400);
}
