import JSZip from "jszip";
import type { SheetLayout } from "../nesting/types";

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function exportSvgElement(svg: SVGSVGElement, filename = "sheet.svg") {
  if (!svg.getAttribute("xmlns")) svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const source = svg.outerHTML;
  downloadText(filename, source);
}

export function exportSvgToPng(svg: SVGSVGElement, filename = "sheet.png") {
  const xml = new XMLSerializer().serializeToString(svg);
  const svg64 = "data:image/svg+xml;charset=utf-8;base64," + btoa(unescape(encodeURIComponent(xml)));

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, svg.viewBox.baseVal.width || svg.clientWidth || 1024);
    canvas.height = Math.max(1, svg.viewBox.baseVal.height || svg.clientHeight || 768);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };
  img.src = svg64;
}

/** Programmatically create SVG markup for a sheet (headless render). */
function svgStringForSheet(sheet: SheetLayout): string {
  const ns = "http://www.w3.org/2000/svg";
  const parts = [
    `<svg xmlns="${ns}" width="${sheet.width}" height="${sheet.height}" viewBox="0 0 ${sheet.width} ${sheet.height}">`,
    `<rect x="0" y="0" width="${sheet.width}" height="${sheet.height}" stroke="#d1d5db" fill="none" stroke-width="1"/>`
  ];
  for (const p of sheet.placed) {
    parts.push(
      `<g>`,
      `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" stroke="#111827" fill="#ffffff" fill-opacity="0.85" />`,
      p.name ? `<text x="${p.x + 4}" y="${p.y + 14}" font-size="10" fill="#111827">${escapeXml(p.name)}</text>` : "",
      `</g>`
    );
  }
  parts.push(`</svg>`);
  return parts.join("");
}
function escapeXml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;" }[ch]!));
}

export async function exportAllSheetsZIP(sheets: SheetLayout[], filename = "sheets.zip") {
  const zip = new JSZip();
  sheets.forEach((sh, i) => {
    const svg = svgStringForSheet(sh);
    zip.file(`sheet-${String(i + 1).padStart(3, "0")}.svg`, svg);
  });
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
