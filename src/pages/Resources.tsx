import { useEffect, useMemo, useState } from "react";
import {
  Download,
  FileAudio,
  FileText,
  FileVideo,
  FolderOpen,
  Loader2,
  Search,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listResources, type ResourceCategory } from "@/lib/resources";

/**
 * The resources library.
 *
 * Nothing here is locked. Everything a member can see, they can download,
 * because restricted material lives inside a course instead. That is why
 * there is no lock icon and no upgrade prompt on this page.
 */

/** Picks an icon from the resource's type, falling back to a document. */
const iconFor = (type: string | null) => {
  const t = (type ?? "").toLowerCase();
  if (t.includes("video")) return FileVideo;
  if (t.includes("audio") || t.includes("mp3")) return FileAudio;
  return FileText;
};

const Resources = () => {
  const [categories, setCategories] = useState<ResourceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    listResources().then((rows) => {
      setCategories(rows);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;

    return categories
      .map((c) => ({
        ...c,
        resources: c.resources.filter(
          (r) =>
            r.title.toLowerCase().includes(q) ||
            (r.description ?? "").toLowerCase().includes(q) ||
            (r.type ?? "").toLowerCase().includes(q),
        ),
      }))
      .filter((c) => c.resources.length > 0);
  }, [categories, query]);

  const total = categories.reduce((n, c) => n + c.resources.length, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Resources</h1>
            <p className="mt-1 text-muted-foreground">
              Templates, guides and handouts. Everything here is yours to
              download.
            </p>
          </div>

          {total > 0 && (
            <div className="relative min-w-[240px]">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                className="pl-9"
                placeholder="Search resources"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          )}
        </div>

        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : total === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
              <FolderOpen
                className="h-8 w-8 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="font-medium">Nothing here yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Templates and guides will appear on this page as they are
                published.
              </p>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground">Nothing matches that.</p>
        ) : (
          <div className="space-y-8">
            {filtered.map((category) => (
              <section key={category.id} className="space-y-3">
                <div>
                  <h2 className="text-xl font-semibold">{category.title}</h2>
                  {category.description && (
                    <p className="text-sm text-muted-foreground">
                      {category.description}
                    </p>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {category.resources.map((resource) => {
                    const Icon = iconFor(resource.type);
                    return (
                      <Card key={resource.id}>
                        <CardContent className="flex items-center justify-between gap-4 p-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="rounded-md bg-muted p-2">
                              <Icon
                                className="h-5 w-5 text-muted-foreground"
                                aria-hidden="true"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {resource.title}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {[resource.type, resource.size]
                                  .filter(Boolean)
                                  .join(" • ") || "Download"}
                              </p>
                              {resource.description && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {resource.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <Button asChild variant="outline" size="sm">
                            <a
                              href={resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Download
                                className="mr-2 h-4 w-4"
                                aria-hidden="true"
                              />
                              Download
                            </a>
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Resources;
