// Measures LCP, CLS, TTFB and transferred JS on key pages, as a mid-range phone on a slow 4G
// connection would see them (Chrome DevTools throttling: 4x CPU, 1.6 Mbps down, 150 ms RTT).
// Usage: BASE_URL=http://localhost:3100 node scripts/perf.mjs
import { chromium, devices } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const PAGES = ["/", "/emergency", "/pharmacy/medicines", "/doctorcare", "/coverage", "/resources"];
const RUNS = Number(process.env.RUNS ?? 3);

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const rows = [];
for (const path of PAGES) {
  const samples = [];
  for (let i = 0; i < RUNS; i++) {
    const ctx = await browser.newContext({ ...devices["Pixel 5"] });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.addInitScript(() => {
      window.__lcp = 0; window.__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => ({ lcp: window.__lcp, cls: window.__cls, ttfb: performance.getEntriesByType("navigation")[0].responseStart,
      jsKb: performance.getEntriesByType("resource").filter((r) => r.initiatorType === "script").reduce((n, r) => n + r.transferSize, 0) / 1024,
      jsDecodedKb: performance.getEntriesByType("resource").filter((r) => r.initiatorType === "script").reduce((n, r) => n + r.decodedBodySize, 0) / 1024 }));
    samples.push(m);
    await ctx.close();
  }
  const med = (k) => samples.map((s) => s[k]).sort((a, b) => a - b)[Math.floor(samples.length / 2)];
  rows.push({ page: path, "LCP ms": Math.round(med("lcp")), CLS: med("cls").toFixed(3), "TTFB ms": Math.round(med("ttfb")), "JS KB transferred": Math.round(med("jsKb")), "JS KB decoded": Math.round(med("jsDecodedKb")) });
}
await browser.close();
console.table(rows);
const bad = rows.filter((r) => r["LCP ms"] > 2500 || Number(r.CLS) > 0.1);
console.log(bad.length ? `Over budget (LCP 2.5 s, CLS 0.1): ${bad.map((r) => r.page).join(", ")}` : "All pages within budget (LCP ≤ 2.5 s, CLS ≤ 0.1).");
