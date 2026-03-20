import type { TokenRow } from "./metabase-queries.js";
import { moneySmart, growthBadge, acqBadge } from "./formatters.js";

export function buildPlatformHtml(tokens: TokenRow[], topN = 10): string {
  tokens.sort((a, b) => (b.total_value_24h ?? 0) - (a.total_value_24h ?? 0));

  const dateStr = new Date().toLocaleDateString("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "2-digit", month: "2-digit", year: "numeric",
  }).replace(/\//g, "-");

  const totalAll = tokens.reduce((s, t) => s + (Number(t.total_value_all) || 0), 0);
  const filled24h = tokens.reduce((s, t) => s + (Number(t.total_value_24h) || 0), 0);
  const growthPct = totalAll > 0 ? (filled24h / totalAll) * 100 : 0;

  const dpTot24h = tokens.reduce((s, t) => s + (Number(t.total_exit_volume_24h) || 0), 0);
  const dpFil24h = tokens.reduce((s, t) => s + (Number(t.total_exit_volume_filled_24h) || 0), 0);
  const dpRate24h = dpTot24h > 0 ? (dpFil24h / dpTot24h) * 100 : 0;

  const wNew = tokens.reduce((s, t) => s + (Number(t.num_new_wallets_24h) || 0), 0);
  const wOld = tokens.reduce((s, t) => s + (Number(t.num_old_wallets_24h) || 0), 0);
  const wTot = wNew + wOld;
  const acqRate = wTot > 0 ? (wNew / wTot) * 100 : 0;

  const feesSpot = Math.max(filled24h - dpFil24h, 0) * 0.025;
  const feesRs = dpFil24h * 0.05;
  const feesTotal = feesSpot + feesRs;

  const out: string[] = [];
  out.push(`🐳 <b>Whales Market — Fresh Meat Daily</b> · <u>${dateStr}</u>`);
  out.push(`24H Bags: ${moneySmart(filled24h)} • ${growthBadge(growthPct)}`);
  out.push(`24H Fresh Trade: ${wNew}${wTot ? `  • ${acqBadge(acqRate)}` : ""}`);
  out.push(`RS 24H: ${moneySmart(dpTot24h)} / ${moneySmart(dpFil24h)} (ape rate ~${Math.round(dpRate24h)}%)`);

  out.push(`\n💰 <b>24H Fees</b>`);
  out.push(`• <b>Total Fees:</b> ${moneySmart(feesTotal)}`);
  out.push(`• Normal Fee (2.5%): ${moneySmart(feesSpot)}`);
  out.push(`• RS's Fees (5%): ${moneySmart(feesRs)}`);

  out.push(`\n🏅 <b>Top Tokens (by 24h Filled)</b>`);
  tokens.slice(0, topN).forEach((t, i) => {
    const sym = t.token_symbol || "?";
    const chain = t.network_name || "-";
    out.push(`<b>${i + 1}) $${sym}</b> <i>(${chain})</i> • <b>24h:</b> ${moneySmart(t.total_value_24h)}`);

    const wN = Number(t.num_new_wallets_24h) || 0;
    const wO = Number(t.num_old_wallets_24h) || 0;
    const wT = wN + wO;
    const wAc = wT > 0 ? (wN / wT) * 100 : 0;
    out.push(`24h Wallets: <b>${wT}</b>${wT ? ` (New User <b>${wN}</b>, ${acqBadge(wAc)})` : ""}`);

    if (t.total_volume_incl_offer || t.total_value_all) {
      out.push(`Total Volume on Web / Filled: ${moneySmart(t.total_volume_incl_offer)} / ${moneySmart(t.total_value_all)}`);
    }

    const rsAll = Number(t.total_value_exit_position_all_time) || 0;
    const rsFil = Number(t.total_value_filled_exit_position_all_time) || 0;
    if (rsAll || rsFil) {
      out.push(`RS's All Time (All, Filled): ${moneySmart(rsAll)} / ${moneySmart(rsFil)}`);
    }

    if (i < Math.min(topN, tokens.length) - 1) out.push("— — —");
  });

  return out.join("\n");
}
