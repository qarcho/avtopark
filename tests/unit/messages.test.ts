import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ka from "../../messages/ka.json";

function keys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

function placeholders(s: string) {
  return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe("translations", () => {
  it("Georgian and English have exactly the same keys", () => {
    expect(keys(ka).sort()).toEqual(keys(en).sort());
  });

  it("no translation is empty and placeholders match", () => {
    const get = (o: Record<string, unknown>, path: string) =>
      path.split(".").reduce<unknown>((x, k) => (x as Record<string, unknown>)[k], o) as string;
    for (const k of keys(ka)) {
      expect(get(ka, k).trim(), k).not.toBe("");
      expect(get(en, k).trim(), k).not.toBe("");
      expect(placeholders(get(ka, k)), k).toEqual(placeholders(get(en, k)));
    }
  });
});
