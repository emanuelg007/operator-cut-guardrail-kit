import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const TARGETS = [
  "#settings",
  "#board-svg",
  "#header-map-drawer", // adjust if your drawer uses a different id
  "#raw-preview",
  "#normalized-preview",
] as const;

type Box = { x: number; y: number; width: number; height: number };
type ProbeResult = {
  baseURL?: string;
  viewport: { width: number; height: number };
  results: Array<{
    selector: string;
    present: boolean;
    visible?: boolean;
    box?: Box;
    offscreen?: boolean;
    overlapping?: string[];
  }>;
  console?: Array<{ type: string; text: string }>;
  errors?: string[];
};

test("layout probe @probe", async ({ page }) => {
  const vp = page.viewportSize() || { width: 1280, height: 800 };
  const baseURL =
    (test.info().project.use.baseURL as string | undefined) ??
    process.env.BASE_URL ??
    "http://localhost:5173/";
  const report: ProbeResult = {
    baseURL,
    viewport: vp,
    results: [],
    console: [],
    errors: [],
  };

  // capture console + page errors
  page.on("console", (msg) =>
    report.console!.push({ type: msg.type(), text: msg.text() })
  );
  page.on("pageerror", (err) => report.errors!.push(`pageerror: ${err.message}`));

  // navigate (don’t throw)
  try {
    await page.goto(baseURL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  } catch (e: any) {
    report.errors!.push(`goto: ${e?.message || e}`);
  }

  await page.waitForTimeout(400);

  // probe elements
  const boxes: Record<string, Box> = {};
  for (const sel of TARGETS) {
    try {
      const el = await page.$(sel);
      if (!el) {
        report.results.push({ selector: sel, present: false });
        continue;
      }
      const box = await el.boundingBox();
      const visible = await el.isVisible();
      const simplified = box
        ? {
            x: Math.round(box.x),
            y: Math.round(box.y),
            width: Math.round(box.width),
            height: Math.round(box.height),
          }
        : undefined;

      if (simplified) boxes[sel] = simplified;

      report.results.push({
        selector: sel,
        present: true,
        visible,
        box: simplified,
        offscreen: simplified
          ? simplified.y + simplified.height > vp.height ||
            simplified.x + simplified.width > vp.width
          : undefined,
      });
    } catch (e: any) {
      report.results.push({ selector: sel, present: false });
      report.errors!.push(`inspect ${sel}: ${e?.message || e}`);
    }
  }

  // overlap detection
  const overlaps = (a: Box, b: Box) =>
    !(
      a.x + a.width <= b.x ||
      b.x + b.width <= a.x ||
      a.y + a.height <= b.y ||
      b.y + b.height <= a.y
    );
  for (const r of report.results) {
    if (!r.present || !r.box) continue;
    const hits: string[] = [];
    for (const otherSel of Object.keys(boxes)) {
      if (otherSel === r.selector) continue;
      if (overlaps(r.box, boxes[otherSel])) hits.push(otherSel);
    }
    if (hits.length) r.overlapping = hits;
  }

  // artifacts (don’t throw)
  try {
    await page.screenshot({
      path: "playwright-report/layout.png",
      fullPage: true,
    });
  } catch (e: any) {
    report.errors!.push(`screenshot: ${e?.message || e}`);
  }

  // write JSON to disk and also print it
  mkdirSync("playwright-report", { recursive: true });
  writeFileSync(
    path.join("playwright-report", "probe.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(report, null, 2));

  // always pass (probe, not a gate)
  expect.soft(true).toBeTruthy();
});

