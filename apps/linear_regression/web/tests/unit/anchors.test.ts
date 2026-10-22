import { describe, expect, it } from "vitest";
import { OLD_ANCHORS, resolveAnchor } from "../../src/page/anchors";

describe("the old links", () => {
  it("send each old anchor to its new place", () => {
    expect(resolveAnchor("#working")).toEqual({ hash: "#watch" });
    expect(resolveAnchor("#found")).toEqual({ hash: "#verdict" });
    expect(resolveAnchor("#final-test")).toEqual({ hash: "#verdict" });
    expect(resolveAnchor("#try-your-own")).toEqual({ hash: "#try" });
    expect(resolveAnchor("#data")).toEqual({ hash: "#scorebook", panel: "data" });
  });

  it("leave the new anchors and anything else alone", () => {
    for (const hash of ["#watch", "#verdict", "#try", "#scorebook", "#hero", "", "#nope"]) expect(resolveAnchor(hash)).toBeNull();
  });

  it("only ever point at an anchor that is not itself an old one, so there is no loop", () => {
    for (const target of Object.values(OLD_ANCHORS)) expect(resolveAnchor(target.hash)).toBeNull();
  });
});
