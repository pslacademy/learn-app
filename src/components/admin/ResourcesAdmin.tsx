import { useEffect, useState } from "react";
import { FolderOpen, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { UnsavedBar } from "@/components/UnsavedBar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import {
  listResources,
  type Resource,
  type ResourceCategory,
} from "@/lib/resources";
import { cn } from "@/lib/utils";

/**
 * Resources, in Admin.
 *
 * No audience controls, unlike courses and events, because the library is
 * open to every signed-in member. Restricted material belongs in a course.
 * There is nothing to decide here, so there is nothing to get wrong.
 *
 * Edits are held and written by Save all changes, matching the course
 * builder. Adding and deleting write immediately, for the same reason as
 * there: a new row has to exist before it can be edited.
 */
export const ResourcesAdmin = () => {
  const { toast } = useToast();
  const [categories, setCategories] = useState<ResourceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catDraft, setCatDraft] = useState<Record<string, Partial<ResourceCategory>>>({});
  const [resDraft, setResDraft] = useState<Record<string, Partial<Resource>>>({});

  const reload = async () => {
    // Empty categories included: the team needs to see one in order to fill it.
    setCategories(await listResources(true));
    setCatDraft({});
    setResDraft({});
  };

  useEffect(() => {
    reload().then(() => setLoading(false));
  }, []);

  const dirty =
    Object.keys(catDraft).length + Object.keys(resDraft).length > 0;

  const catValue = <K extends keyof ResourceCategory>(
    c: ResourceCategory,
    key: K,
  ): ResourceCategory[K] => (catDraft[c.id]?.[key] ?? c[key]) as ResourceCategory[K];

  const resValue = <K extends keyof Resource>(r: Resource, key: K): Resource[K] =>
    (resDraft[r.id]?.[key] ?? r[key]) as Resource[K];

  const editCat = (id: string, patch: Partial<ResourceCategory>) =>
    setCatDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const editRes = (id: string, patch: Partial<Resource>) =>
    setResDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const run = async (what: string, fn: () => Promise<{ error?: unknown }>) => {
    setSaving(true);
    try {
      const { error } = await fn();
      if (error) throw new Error((error as { message: string }).message);
      await reload();
      toast({ title: what });
    } catch (e) {
      toast({
        variant: "destructive",
        title: `Could not ${what.toLowerCase()}`,
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const [id, patch] of Object.entries(catDraft)) {
        const { resources: _drop, ...fields } = patch as Partial<ResourceCategory>;
        const { error } = await supabase
          .from("resource_categories")
          .update(fields)
          .eq("id", id);
        if (error) throw new Error(error.message);
      }
      for (const [id, patch] of Object.entries(resDraft)) {
        const { error } = await supabase.from("resources").update(patch).eq("id", id);
        if (error) throw new Error(error.message);
      }
      await reload();
      toast({ title: "Saved", description: "Your changes are live." });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not save",
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />;
  }

  /* The bucket for resources whose category was deleted. It is assembled by
     the reader rather than stored, so it cannot be renamed or added to. */
  const real = categories.filter((c) => c.id !== "uncategorised");
  const orphans = categories.find((c) => c.id === "uncategorised");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Open to every signed-in member. Anything that should be restricted
          belongs in a course instead.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={saving}
            onClick={() =>
              run("Category added", async () =>
                supabase.from("resource_categories").insert({
                  title: "New category",
                  sort_order: real.length + 1,
                }),
              )
            }
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Add category
          </Button>
          <Button onClick={saveAll} disabled={saving || !dirty}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Save all changes
          </Button>
        </div>
      </div>

      {real.length === 0 && !orphans && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <FolderOpen className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">No categories yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add a category to group your downloads, then add resources to it.
            </p>
          </CardContent>
        </Card>
      )}

      {real.map((category) => (
        <Card key={category.id}>
          <CardContent className="space-y-4 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Category title</Label>
                <Input
                  value={catValue(category, "title") ?? ""}
                  onChange={(e) => editCat(category.id, { title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Icon</Label>
                <Input
                  placeholder="FileText"
                  value={catValue(category, "icon") ?? ""}
                  onChange={(e) => editCat(category.id, { icon: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  A lucide.dev icon name. An unrecognised one falls back to a
                  document rather than breaking the page.
                </p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  value={catValue(category, "description") ?? ""}
                  onChange={(e) =>
                    editCat(category.id, { description: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-3">
              {category.resources.map((resource) => (
                <div
                  key={resource.id}
                  className={cn(
                    "grid gap-3 rounded-md bg-muted/40 p-3 md:grid-cols-2",
                    !resValue(resource, "is_published") && "opacity-70",
                  )}
                >
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs uppercase tracking-wide">Title</Label>
                    <Input
                      value={resValue(resource, "title") ?? ""}
                      onChange={(e) =>
                        editRes(resource.id, { title: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs uppercase tracking-wide">Type</Label>
                    <Input
                      placeholder="PDF, Video, Audio, Worksheet"
                      value={resValue(resource, "type") ?? ""}
                      onChange={(e) => editRes(resource.id, { type: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs uppercase tracking-wide">Size</Label>
                    <Input
                      placeholder="1.2 MB"
                      value={resValue(resource, "size") ?? ""}
                      onChange={(e) => editRes(resource.id, { size: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs uppercase tracking-wide">File URL</Label>
                    <Input
                      placeholder="https://..."
                      value={resValue(resource, "url") ?? ""}
                      onChange={(e) => editRes(resource.id, { url: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Upload to GoHighLevel Media Storage and paste the public
                      URL here.
                    </p>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs uppercase tracking-wide">
                      Description, optional
                    </Label>
                    <Textarea
                      rows={2}
                      value={resValue(resource, "description") ?? ""}
                      onChange={(e) =>
                        editRes(resource.id, { description: e.target.value })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 md:col-span-2">
                    <div className="flex items-center gap-3">
                      <Switch
                        id={`pub-${resource.id}`}
                        checked={Boolean(resValue(resource, "is_published"))}
                        onCheckedChange={(v) =>
                          editRes(resource.id, { is_published: v })
                        }
                      />
                      <Label htmlFor={`pub-${resource.id}`}>Published</Label>
                    </div>

                    <ConfirmDelete
                      name={resValue(resource, "title") || "this resource"}
                      onConfirm={() =>
                        run("Resource deleted", async () =>
                          supabase.from("resources").delete().eq("id", resource.id),
                        )
                      }
                    >
                      <Button variant="ghost" size="sm" disabled={saving}>
                        <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                        Remove
                      </Button>
                    </ConfirmDelete>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() =>
                    run("Resource added", async () =>
                      supabase.from("resources").insert({
                        category_id: category.id,
                        title: "New resource",
                        url: "",
                        is_published: false,
                        sort_order: category.resources.length + 1,
                      }),
                    )
                  }
                >
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  Add resource
                </Button>

                <ConfirmDelete
                  name={catValue(category, "title") || "this category"}
                  consequence={
                    category.resources.length > 0
                      ? `Its ${category.resources.length} resource${category.resources.length === 1 ? "" : "s"} are kept and moved to Other resources.`
                      : undefined
                  }
                  onConfirm={() =>
                    run("Category deleted", async () =>
                      supabase
                        .from("resource_categories")
                        .delete()
                        .eq("id", category.id),
                    )
                  }
                >
                  <Button variant="ghost" size="sm" disabled={saving}>
                    <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                    Delete category
                  </Button>
                </ConfirmDelete>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {orphans && orphans.resources.length > 0 && (
        <Card className="border-dashed">
          <CardContent className="space-y-3 p-6">
            <div>
              <p className="font-medium">Other resources</p>
              <p className="text-sm text-muted-foreground">
                These lost their category when it was deleted. They still work.
                Give them a category by editing them here, or delete them.
              </p>
            </div>
            {orphans.resources.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-4 rounded-md bg-muted/40 p-3"
              >
                <span className="truncate text-sm font-medium">{r.title}</span>
                <ConfirmDelete
                  name={r.title || "this resource"}
                  onConfirm={() =>
                    run("Resource deleted", async () =>
                      supabase.from("resources").delete().eq("id", r.id),
                    )
                  }
                >
                  <Button variant="ghost" size="sm" disabled={saving}>
                    <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                    Remove
                  </Button>
                </ConfirmDelete>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <UnsavedBar
        dirty={dirty}
        saving={saving}
        what="resources"
        onSave={saveAll}
        onDiscard={() => {
          setCatDraft({});
          setResDraft({});
        }}
      />
    </div>
  );
};

export default ResourcesAdmin;
