import { describe, expect, it } from "vitest";
import { addDays, daysBetween, todayInTbilisi } from "./dates";

describe("dates", () => {
  it("uses the Tbilisi date, not the server's (UTC+4)", () => {
    // 21:30 UTC on 9 March is already 01:30 on 10 March in Tbilisi.
    expect(todayInTbilisi(new Date("2026-03-09T21:30:00Z"))).toBe("2026-03-10");
    expect(todayInTbilisi(new Date("2026-03-09T19:59:00Z"))).toBe("2026-03-09");
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-01-30", 3)).toBe("2026-02-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("counts days between dates", () => {
    expect(daysBetween("2026-05-01", "2026-05-05")).toBe(4);
    expect(daysBetween("2026-05-05", "2026-05-01")).toBe(-4);
  });
});
