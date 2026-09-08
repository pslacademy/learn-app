// src/lib/resources.ts
//
// The resources library.
//
// Open to every signed-in member, deliberately. Anything that must be
// restricted lives inside a course, where entitlement is enforced on the
// lesson row. Gating the same material in two places with two sets of rules
// is how the two eventually disagree.
//
// So there is no access logic in this file at all. The database returns
// published resources to a member in good standing, and everything to the
// team, and that is the whole of it.

import { supabase } from "./supabase";

export interface Resource {
  id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  /** PDF, Video, Audio, Worksheet. Displayed, and picks the icon. */
  type: string | null;
  /** "1.2 MB", written by hand. We never see the file, only a link to it. */
  size: string | null;
  url: string;
  sort_order: number;
  is_published: boolean;
}

export interface ResourceCategory {
  id: string;
  title: string;
  description: string | null;
  /** A lucide icon name. An unknown one falls back rather than breaking. */
  icon: string | null;
  sort_order: number;
  resources: Resource[];
}

/**
 * Every category, with its resources.
 *
 * Categories with nothing in them are dropped for members and kept for the
 * team, who need to see an empty category in order to fill it.
 */
export const listResources = async (
  includeEmpty = false,
): Promise<ResourceCategory[]> => {
  const [{ data: categories, error }, { data: resources }] = await Promise.all([
    supabase
      .from("resource_categories")
      .select("id, title, description, icon, sort_order")
      .order("sort_order"),
    supabase
      .from("resources")
      .select(
        "id, category_id, title, description, type, size, url, sort_order, is_published",
      )
      .order("sort_order"),
  ]);

  if (error) {
    console.error("Could not read resources:", error.message);
    return [];
  }

  const byCategory = new Map<string, Resource[]>();
  const loose: Resource[] = [];

  for (const r of (resources ?? []) as Resource[]) {
    if (!r.category_id) {
      loose.push(r);
      continue;
    }
    const list = byCategory.get(r.category_id) ?? [];
    list.push(r);
    byCategory.set(r.category_id, list);
  }

  const out: ResourceCategory[] = (categories ?? []).map((c) => ({
    ...(c as Omit<ResourceCategory, "resources">),
    resources: byCategory.get(c.id) ?? [],
  }));

  /*
    A resource whose category was deleted keeps working. The foreign key sets
    category_id to null rather than removing the row, so the file is still
    reachable and still fixable, instead of vanishing with the heading.
  */
  if (loose.length > 0) {
    out.push({
      id: "uncategorised",
      title: "Other resources",
      description: null,
      icon: "FileText",
      sort_order: 9999,
      resources: loose,
    });
  }

  return includeEmpty ? out : out.filter((c) => c.resources.length > 0);
};
