// src/csv/autoMap.ts
import type { Mapping } from "./normalize";

const SYN = {
  Name: [
    "Name","Component","Part","Item","Description","Panel Name","Label","Part Name"
  ],
  Material: [
    "Material","Board","BoardName","Species","Color","Finish","Laminate",
    "Panel","Material Code","MaterialCode","Material Name","Board Material"
  ],
  Length: [
    "Length","Long","DimY","Height","L","Len","Y","Panel Length","Cut Length","Long Side"
  ],
  Width: [
    "Width","DimX","X","W","Panel Width","Cut Width","Short Side"
  ],
  Qty: [
    "Qty","Quantity","QTY","Count","Pcs","Pieces","Q'ty","No","Number","Units"
  ],
} as const;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "").trim();

/** Auto-guess a Mapping from header synonyms; seeds with any saved defaults. */
export function autoMapHeaders(headers: string[], seed?: Partial<Mapping>): Partial<Mapping> {
  const out: Partial<Mapping> = { ...(seed ?? {}) };
  const Hnorm = headers.map((h) => norm(h));

  const find = (cands: readonly string[]) => {
    // exact normalized match
    for (const c of cands) {
      const n = norm(c);
      const i = Hnorm.indexOf(n);
      if (i >= 0) return headers[i];
    }
    // substring fallback (e.g. "PanelWidth(mm)")
    for (const c of cands) {
      const n = norm(c);
      const i = Hnorm.findIndex((hn) => hn.includes(n) || n.includes(hn));
      if (i >= 0) return headers[i];
    }
    return undefined;
  };

  out.Name     ??= find(SYN.Name);
  out.Material ??= find(SYN.Material);
  out.Length   ??= find(SYN.Length);
  out.Width    ??= find(SYN.Width);
  out.Qty      ??= find(SYN.Qty);

  return out;
}

export function mappingMissing(m: Partial<Mapping>): (keyof Mapping)[] {
  const need: (keyof Mapping)[] = ["Name","Material","Length","Width","Qty"];
  return need.filter((k) => !m[k] || String(m[k]).trim() === "");
}
