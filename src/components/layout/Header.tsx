import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu,
  LogOut,
  Bell,
  Settings as SettingsIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./Sidebar";
import { BRAND } from "@/config/brand";
import { getProfile, signOut, type Profile } from "@/lib/account";
import {
  getNotifications,
  unreadCount,
  markAllRead,
  notificationLine,
  notificationHref,
  type Notification,
} from "@/lib/notifications";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

/**
 * The top bar.
 *
 * The bell reads the notifications table, which only ever contains rows the
 * database wrote. Opening it marks everything read, which is what everybody
 * expects and saves a second control nobody would use.
 */
export function Header() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getProfile().then((p) => {
        if (!cancelled) setProfile(p);
      });

    const loadBell = async () => {
      const [list, count] = await Promise.all([
        getNotifications(),
        unreadCount(),
      ]);
      if (cancelled) return;
      setNotifications(list);
      setUnread(count);
    };

    load();
    loadBell();

    /* Polled rather than subscribed. A live subscription is the better answer
       once there are people in the room; a minute is soon enough for a bell
       and costs one query. */
    const timer = window.setInterval(loadBell, 60_000);

    // Settings dispatches this after a save so the name and picture up here
    // change at the same moment as the form below.
    window.addEventListener("profileUpdate", load);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("profileUpdate", load);
    };
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.email ||
    "";

  const initials =
    `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}` || "U";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b bg-card px-4 md:px-8">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
            <Menu size={20} />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar className="flex w-full border-r-0" />
        </SheetContent>
      </Sheet>

      <div className="md:hidden">
        <img src={BRAND.marks.logo} alt={BRAND.organisation} className="h-8 w-auto" />
      </div>

      <div className="ml-auto flex items-center gap-3">
        {/* The support page, not the marketing site. Sending a signed-in
            member out to a public contact form to ask about a lesson was
            always a placeholder. */}
        <Link
          to="/support"
          className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
        >
          Contact support
        </Link>

        <DropdownMenu
          onOpenChange={(open) => {
            /* Opening it is reading it. A separate "mark all read" would be a
               control nobody presses, leaving a badge that never clears. */
            if (open && unread > 0) {
              markAllRead().then(() => setUnread(0));
            }
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label={
                unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
              }
            >
              <Bell size={20} />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Nothing yet.
              </p>
            ) : (
              notifications.map((n) => (
                <DropdownMenuItem key={n.id} asChild>
                  <Link to={notificationHref(n)} className="flex-col items-start gap-1">
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {notificationLine(n)}
                      </span>
                      {!n.read_at && (
                        <Badge variant="secondary" className="text-[10px]">
                          New
                        </Badge>
                      )}
                    </span>
                    {n.excerpt && (
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {n.excerpt}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(n.created_at).toLocaleString("en-AU")}
                    </span>
                  </Link>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-3 rounded-md px-1 py-1 transition-colors hover:bg-muted"
            >
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold leading-tight">{name}</p>
                {/* Everybody gets a label. "Member" is the ordinary case and
                    saying so is better than an empty space that looks like
                    something failed to load.

                    It is not a rank. A member holding three communities is
                    still a member, so the label says who they are rather than
                    trying to summarise what they hold. */}
                <p className="text-xs leading-tight text-muted-foreground">
                  {profile?.is_admin
                    ? "PSLA Admin"
                    : profile?.is_editor
                      ? "PSLA Editor"
                      : "Member"}
                </p>
              </div>
              <Avatar className="h-9 w-9">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{name}</p>
              <p className="text-xs text-muted-foreground">{profile?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <SettingsIcon size={16} className="mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut size={16} className="mr-2" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
