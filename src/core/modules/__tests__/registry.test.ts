import { describe, expect, it } from "vitest";
import { createRegistry, routeSegments } from "../registry";
import type { ModuleManifest } from "../types";

const Icon = () => null;
const m = (id: string, route?: string, order = 0): ModuleManifest => ({
  id,
  name: id,
  description: id,
  icon: Icon,
  route,
  order,
});

describe("createRegistry", () => {
  it("sorts by order and resolves routes", () => {
    const r = createRegistry([m("b", "/b", 2), m("a", "/", 1), m("c", undefined, 3)]);
    expect(r.modules.map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(r.defaultModule.id).toBe("a");
    expect(r.byRoute("/b/")?.id).toBe("b");
    expect(r.byRoute("/B")?.id).toBe("b");
    expect(r.routed().map((x) => x.id)).toEqual(["a", "b"]);
    expect(routeSegments(r)).toEqual([{ slug: [] }, { slug: ["b"] }]);
  });
  it("groups modules into navigation entries", () => {
    const r = createRegistry(
      [
        { ...m("e", "/analysis", 1), group: "an" },
        { ...m("rv", "/review", 2), group: "an" },
        m("s", "/settings", 3),
      ],
      [{ id: "an", label: "Analyse", icon: Icon, order: 5, showMoves: true }],
    );
    expect(r.groups().map((g) => [g.id, g.label, g.route, g.modules.length])).toEqual([
      ["s", "s", "/settings", 1],
      ["an", "Analyse", "/analysis", 2],
    ]);
    expect(r.groupOf(r.byId("rv")!).id).toBe("an");
  });
  it("rejects duplicate ids and routes", () => {
    expect(() => createRegistry([m("a", "/x"), m("a", "/y")])).toThrow(/Duplicate module id/);
    expect(() => createRegistry([m("a", "/x"), m("b", "x")])).toThrow(/claimed/);
    expect(() => createRegistry([m("Bad_Id")])).toThrow(/kebab/);
  });
});
