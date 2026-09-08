import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  Video,
  FolderOpen,
  Users,
  Megaphone,
  HelpCircle,
  Trophy,
  ChevronDown,
  MessageSquare,
  Settings,
  LogOut,
  SlidersHorizontal,
} from "lucide-react";
import { BRAND } from "@/config/brand";
import { getProfile, signOut, type Profile } from "@/lib/account";
import { allCommunities, memberCommunityIds, type Community } from "@/lib/communities";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * The academy's navigation.
 *
 * Only sections that exist appear here. A link to a page that has not been
 * built is a dead control, and the audit script counts it as one. Courses,
 * Resources, Events, Community, Messages, Achievements, Support and Admin
 * are each added by the phase that builds them.
 */
const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: BookOpen, label: "My Courses", href: "/courses" },
  { icon: CalendarDays, label: "Events", href: "/events" },
  { icon: Video, label: "Replays", href: "/replays" },
  { icon: FolderOpen, label: "Resources", href: "/resources" },
];

/*
  Community is a section rather than a link, matching EI Academy: the channels
  and the directory are sub-items under it, and the team's space switcher sits
  in the sidebar rather than on the page. Same shape, same muscle memory.
*/
const communitySpaces = [
  { icon: Megaphone, label: "Announcements", space: "announcements" },
  { icon: HelpCircle, label: "Ask a Question", space: "questions" },
  { icon: Trophy, label: "Share a Win", space: "wins" },
  { icon: Users, label: "Members Directory", space: "directory" },
];

const secondaryItems = [
  { icon: MessageSquare, label: "Messages", href: "/messages" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar({ className }: { className?: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [spaces, setSpaces] = useState<Community[]>([]);
  const [viewing, setViewing] = useState<string | null>(null);

  const isTeam = Boolean(profile?.is_admin || profile?.is_editor);
  const inCommunity = location.pathname === "/community";
  const [open, setOpen] = useState(inCommunity);

  useEffect(() => {
    if (inCommunity) setOpen(true);
  }, [inCommunity]);

  // Admin is shown only to the team. Hiding it is a courtesy: the page redirects
  // and every policy refuses regardless, so this is not what keeps them out.
  useEffect(() => {
    let cancelled = false;
    Promise.all([getProfile(), allCommunities(), memberCommunityIds()]).then(
      ([p, all, mine]) => {
        if (cancelled) return;
        setProfile(p);

        /* The team may read every space, so they choose one. A member has one
           and is not asked. */
        const visible =
          p?.is_admin || p?.is_editor ? all : all.filter((c) => mine.includes(c.id));
        setSpaces(visible);

        const fromUrl = new URLSearchParams(location.search).get("community");
        setViewing(
          fromUrl && visible.some((c) => c.id === fromUrl)
            ? fromUrl
            : (visible[0]?.id ?? null),
        );
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const currentSpace = new URLSearchParams(location.search).get("space");

  /* The community id travels in the URL so the page and the sidebar cannot
     disagree about which space is being read. */
  const spaceHref = (space: string) =>
    `/community?space=${space}${viewing ? `&community=${viewing}` : ""}`;

  // Ends the real session, not just a flag in this browser.
  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <aside
      className={cn(
        "hidden h-full w-64 flex-col border-r bg-sidebar md:flex",
        className,
      )}
    >
      <div className="flex items-center justify-start border-b px-6 py-6">
        <Link to="/dashboard" className="flex w-full items-center justify-start">
          <img
            src={BRAND.marks.logo}
            alt={BRAND.organisation}
            className="h-12 w-auto object-contain"
          />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon
                  size={18}
                  className={cn(isActive ? "text-primary" : "text-muted-foreground")}
                />
                {item.label}
              </Link>
            );
          })}

          {/* Community, as a section. Clicking the header opens the overview;
              clicking it again when already there collapses the section. */}
          <div className="w-full space-y-1">
            <div
              onClick={() => {
                if (!inCommunity) navigate("/community");
                else setOpen(!open);
              }}
              className={cn(
                "flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                inCommunity && !location.search
                  ? "bg-primary/10 text-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <div className="flex items-center gap-3">
                <Users
                  size={18}
                  className={cn(inCommunity ? "text-primary" : "text-muted-foreground")}
                />
                <span>Community</span>
              </div>
              <ChevronDown
                size={14}
                className={cn(
                  "transition-transform duration-200",
                  open ? "rotate-0 text-primary" : "-rotate-90 text-muted-foreground",
                )}
              />
            </div>

            {open && (
              <div className="ml-4 mt-1 space-y-1 border-l border-border/50 px-3">
                {/* Only when there is a choice to make. */}
                {spaces.length > 1 && (
                  <div className="mb-2 mt-2 pr-3">
                    <Select
                      value={viewing ?? ""}
                      onValueChange={(v) => {
                        setViewing(v);
                        /* To that community's home, not to the same channel in
                           it. Changing community is changing room, and the
                           overview says whose room it is. */
                        navigate(`/community?community=${v}`);
                      }}
                    >
                      <SelectTrigger className="h-8 border-primary/20 bg-primary/10 text-xs font-medium text-primary">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {spaces.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            View: {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {communitySpaces.map((item) => {
                  const isActive = inCommunity && currentSpace === item.space;
                  return (
                    <Link
                      key={item.space}
                      to={spaceHref(item.space)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                        isActive
                          ? "bg-primary/5 text-primary"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                      )}
                    >
                      <item.icon size={14} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="py-2">
            <div className="mx-3 h-px bg-border/50" />
          </div>

          {[
            ...secondaryItems,
            ...(isTeam
              ? [{ icon: SlidersHorizontal, label: "Admin", href: "/admin" }]
              : []),
          ].map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon
                  size={18}
                  className={cn(isActive ? "text-primary" : "text-muted-foreground")}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t p-3">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <LogOut size={18} />
          Log out
        </button>
      </div>
    </aside>
  );
}
