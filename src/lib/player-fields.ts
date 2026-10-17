import { prisma } from "@/lib/prisma";

export const BUILTIN_PLAYER_FIELD_KEYS = [
  "full_name",
  "identity_number",
  "jersey_number",
  "position",
] as const;

export type BuiltinPlayerFieldKey = (typeof BUILTIN_PLAYER_FIELD_KEYS)[number];

export const PLAYER_FIELD_TYPES = ["text", "number", "date"] as const;
export type PlayerFieldType = (typeof PLAYER_FIELD_TYPES)[number];

export function normalizePlayerFieldType(raw: string): PlayerFieldType {
  if (raw === "number" || raw === "date") return raw;
  return "text";
}

export function inputTypeForPlayerField(
  fieldType: string
): "text" | "number" | "date" {
  return normalizePlayerFieldType(fieldType);
}

export const DEFAULT_PLAYER_FIELDS = [
  {
    key: "full_name",
    label: "Nama lengkap",
    placeholder: "",
    fieldType: "text",
    required: true,
    locked: true,
    sortOrder: 0,
  },
  {
    key: "identity_number",
    label: "No. identitas",
    placeholder: "",
    fieldType: "text",
    required: false,
    locked: false,
    sortOrder: 1,
  },
  {
    key: "jersey_number",
    label: "No. punggung",
    placeholder: "",
    fieldType: "number",
    required: false,
    locked: false,
    sortOrder: 2,
  },
  {
    key: "position",
    label: "Posisi",
    placeholder: "GK / DF / MF / FW",
    fieldType: "text",
    required: false,
    locked: false,
    sortOrder: 3,
  },
] as const;

export function isBuiltinPlayerFieldKey(key: string): key is BuiltinPlayerFieldKey {
  return (BUILTIN_PLAYER_FIELD_KEYS as readonly string[]).includes(key);
}

export function slugifyFieldKey(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  if (!base) return "";
  if (isBuiltinPlayerFieldKey(base)) return `custom_${base}`;
  return base.startsWith("custom_") ? base : `custom_${base}`;
}

/** Seed field default jika turnamen belum punya konfigurasi form pemain. */
export async function ensureDefaultPlayerFields(tournamentId: string) {
  const count = await prisma.tournamentPlayerField.count({
    where: { tournamentId },
  });
  if (count > 0) return;

  await prisma.tournamentPlayerField.createMany({
    data: DEFAULT_PLAYER_FIELDS.map((f) => ({
      tournamentId,
      key: f.key,
      label: f.label,
      placeholder: f.placeholder || null,
      fieldType: f.fieldType,
      required: f.required,
      locked: f.locked,
      active: true,
      sortOrder: f.sortOrder,
    })),
  });
}
