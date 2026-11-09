import type { ModuleManifest, ModuleRegistry } from "./types";

const ID_RE = /^[a-z][a-z0-9-]*$/;

function normalizeRoute(path: string): string {
  const p = `/${path.replace(/^\/+|\/+$/g, "")}`;
  return p === "/" ? "/" : p.toLowerCase();
}

/** Builds and validates a registry. Throws on duplicate ids/routes so mistakes fail the build. */
export function createRegistry(manifests: ModuleManifest[]): ModuleRegistry {
  const ids = new Set<string>();
  const routes = new Map<string, ModuleManifest>();
  for (const m of manifests) {
    if (!ID_RE.test(m.id)) throw new Error(`Module id "${m.id}" must be kebab-case`);
    if (ids.has(m.id)) throw new Error(`Duplicate module id "${m.id}"`);
    ids.add(m.id);
    if (m.route !== undefined) {
      const r = normalizeRoute(m.route);
      if (routes.has(r)) throw new Error(`Route "${r}" is claimed by "${routes.get(r)!.id}" and "${m.id}"`);
      routes.set(r, m);
    }
  }
  const modules = [...manifests].sort((a, b) => a.order - b.order);
  const defaultModule = routes.get("/") ?? modules[0];
  if (!defaultModule) throw new Error("At least one module is required");

  return {
    modules,
    defaultModule,
    byId: (id) => modules.find((m) => m.id === id),
    byRoute: (path) => routes.get(normalizeRoute(path)),
    routed: () => modules.filter((m) => m.route !== undefined),
  };
}

/** Route segments for generateStaticParams of the optional catch-all route. */
export function routeSegments(registry: ModuleRegistry): { slug: string[] }[] {
  return registry.routed().map((m) => ({
    slug: normalizeRoute(m.route!).split("/").filter(Boolean),
  }));
}
