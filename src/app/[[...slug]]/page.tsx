import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { routeSegments } from "@/core/modules/registry";
import { registry } from "@/modules/registry";

/**
 * Every module route ("/", "/analysis", "/settings", …) is generated from the module
 * registry. The workspace itself lives in the root layout so engine and board state
 * persist across navigation; this page only provides per-module metadata.
 */
export function generateStaticParams() {
  return routeSegments(registry);
}

function moduleFor(slug: string[] | undefined) {
  return registry.byRoute(`/${(slug ?? []).join("/")}`);
}

export async function generateMetadata({ params }: PageProps<"/[[...slug]]">): Promise<Metadata> {
  const { slug } = await params;
  const m = moduleFor(slug);
  if (!m) return { title: "Not found" };
  return m === registry.defaultModule ? {} : { title: m.name, description: m.description };
}

export default async function ModulePage({ params }: PageProps<"/[[...slug]]">) {
  const { slug } = await params;
  const m = moduleFor(slug);
  if (!m) notFound();
  return <h1 className="sr-only">{`Modulo: Chess — ${m.name}`}</h1>;
}
