import { describe, expect, it } from "vitest";
import { avatarColorOf, initialsOf } from "./avatar";

describe("avatar", () => {
  it("génère les initiales", () => {
    expect(initialsOf("Yanis Benali")).toBe("YB");
    expect(initialsOf("léa")).toBe("LÉ");
    expect(initialsOf("jean-marc")).toBe("JM");
    expect(initialsOf("  ")).toBe("?");
  });
  it("donne une couleur stable", () => {
    expect(avatarColorOf("abc")).toBe(avatarColorOf("abc"));
  });
});
