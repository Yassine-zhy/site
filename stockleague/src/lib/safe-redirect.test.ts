import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("garde les chemins internes", () => expect(safeNextPath("/profil")).toBe("/profil"));
  it("refuse les redirections externes", () => {
    expect(safeNextPath("https://evil.com")).toBe("/ligues");
    expect(safeNextPath("//evil.com")).toBe("/ligues");
    expect(safeNextPath("/\\evil.com")).toBe("/ligues");
    expect(safeNextPath(null)).toBe("/ligues");
  });
});
