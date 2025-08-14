// src/csv/aliases.ts

// All upload/export headers EXACTLY as you use them (including spacing/casing)
export type CanonicalKey =
  | "Type"
  | "Name"
  | "Length"
  | "Width"
  | "Quantity"
  | "Notes"
  | "AllowRotate"
  | "Material"
  | "EdgeL1"
  | "EdgeL2"
  | "EdgeW1"
  | "EdgeW2"
  | "IncludeEdgingThickness"
  | "BoardLength"
  | "BoardWidth"
  | "Note3"
  | "Note4"
  | "Group"
  | "ReportTags"
  | "ImportID"
  | "ParentID"
  | "LibraryItemName"
  | "HolesL1"
  | "HolesL2"
  | "HolesW1"
  | "HolesW2"
  | "GrooveL1"
  | "GrooveL2"
  | "GrooveW1"
  | "GrooveW2"
  | "MaterialTag"
  | "EdgeL1Tag"
  | "EdgeL2Tag"
  | "EdgeW1Tag"
  | "EdgeW2Tag"
  | "ApplyMachiningCharge"
  | "LongExpansion"
  | "ShortExpansion";

// EXACT labels as they appear in your files
export const EXACT_HEADER_MAP: Record<CanonicalKey, string> = {
  Type: "Type",
  Name: "Name",
  Length: "Length",
  Width: "Width",
  Quantity: "Quantity",
  Notes: "Notes",
  AllowRotate: "Can Rotate (0 = No / 1 = Yes / 2 = Same As Material)",
  Material: "Material",
  EdgeL1: "Edging Length 1",
  EdgeL2: "Edging Length 2",
  EdgeW1: "Edging Width 1",
  EdgeW2: "Edging Width 2",
  IncludeEdgingThickness: "Include Edging Thickness",
  // You said these sometimes include extra spaces; we keep the export EXACT,
  // but the validator will normalize spacing so either version matches.
  BoardLength: "board length  ",
  BoardWidth: "board width  ",
  Note3: "Note 3",
  Note4: "Note 4",
  Group: "Group",
  ReportTags: "Report Tags",
  ImportID: "Import ID",
  ParentID: "Parent ID",
  LibraryItemName: "Library Item Name",
  HolesL1: "Holes Length 1",
  HolesL2: "Holes Length 2",
  HolesW1: "Holes Width 1",
  HolesW2: "Holes Width 2",
  GrooveL1: "Grooving Length 1",
  GrooveL2: "Grooving Length 2",
  GrooveW1: "Grooving Width 1",
  GrooveW2: "Grooving Width 2",
  MaterialTag: "Material Tag",
  EdgeL1Tag: "Edging Length 1 Tag",
  EdgeL2Tag: "Edging Length 2 Tag",
  EdgeW1Tag: "Edging Width 1 Tag",
  EdgeW2Tag: "Edging Width 2 Tag",
  ApplyMachiningCharge: "Apply Machining Charge",
  LongExpansion: "Long Expansion",
  ShortExpansion: "Short Expansion",
};

// Header order for export (semicolon CSV). This order matches your upload.
export const HEADERS_IN_ORDER: string[] = [
  EXACT_HEADER_MAP.Type,
  EXACT_HEADER_MAP.Name,
  EXACT_HEADER_MAP.Length,
  EXACT_HEADER_MAP.Width,
  EXACT_HEADER_MAP.Quantity,
  EXACT_HEADER_MAP.Notes,
  EXACT_HEADER_MAP.AllowRotate,
  EXACT_HEADER_MAP.Material,
  EXACT_HEADER_MAP.EdgeL1,
  EXACT_HEADER_MAP.EdgeL2,
  EXACT_HEADER_MAP.EdgeW1,
  EXACT_HEADER_MAP.EdgeW2,
  EXACT_HEADER_MAP.IncludeEdgingThickness,
  EXACT_HEADER_MAP.BoardLength,
  EXACT_HEADER_MAP.BoardWidth,
  EXACT_HEADER_MAP.Note3,
  EXACT_HEADER_MAP.Note4,
  EXACT_HEADER_MAP.Group,
  EXACT_HEADER_MAP.ReportTags,
  EXACT_HEADER_MAP.ImportID,
  EXACT_HEADER_MAP.ParentID,
  EXACT_HEADER_MAP.LibraryItemName,
  EXACT_HEADER_MAP.HolesL1,
  EXACT_HEADER_MAP.HolesL2,
  EXACT_HEADER_MAP.HolesW1,
  EXACT_HEADER_MAP.HolesW2,
  EXACT_HEADER_MAP.GrooveL1,
  EXACT_HEADER_MAP.GrooveL2,
  EXACT_HEADER_MAP.GrooveW1,
  EXACT_HEADER_MAP.GrooveW2,
  EXACT_HEADER_MAP.MaterialTag,
  EXACT_HEADER_MAP.EdgeL1Tag,
  EXACT_HEADER_MAP.EdgeL2Tag,
  EXACT_HEADER_MAP.EdgeW1Tag,
  EXACT_HEADER_MAP.EdgeW2Tag,
  EXACT_HEADER_MAP.ApplyMachiningCharge,
  EXACT_HEADER_MAP.LongExpansion,
  EXACT_HEADER_MAP.ShortExpansion,
];

// Normalizer used by validator so "board length  " and "board length" both match.
export function normalizeHeader(label: string): string {
  return (label || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
