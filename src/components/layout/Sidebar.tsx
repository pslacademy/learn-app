import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  Settings,
  LogOut,
  SlidersHorizontal,
} from "lucide-react";
import { BRAND } from "@/config/brand";
import { getProfile, signOut } from "@/lib/account";
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
  { icon: BookOpen, label: "Courses", href: "/courses" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar({ className }: { className?: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isStaff, setIsStaff] = useState(false);

  // Admin is shown only to staff. Hiding it is a courtesy: the page redirects
  // and every policy refuses regardless, so this is not what keeps them out.
  useEffect(() => {
    let cancelled = false;
    getProfile().then((p) => {
      if (!cancelled) setIsStaff(Boolean(p?.is_admin || p?.is_editor));
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
          {[
            ...navItems,
            ...(isStaff
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
