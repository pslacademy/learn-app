import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, LogOut, Settings as SettingsIcon } from "lucide-react";
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

/**
 * The top bar.
 *
 * No notification bell yet. The bell in EI Academy reads a real notifications
 * table; there is nothing to read until the phase that builds one, and a bell
 * that permanently says "nothing here" is a dead control.
 */
export function Header() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getProfile().then((p) => {
        if (!cancelled) setProfile(p);
      });

    load();

    // Settings dispatches this after a save so the name and picture up here
    // change at the same moment as the form below.
    window.addEventListener("profileUpdate", load);
    return () => {
      cancelled = true;
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
        <a
          href={BRAND.links.contact}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
        >
          Contact support
        </a>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-3 rounded-md px-1 py-1 transition-colors hover:bg-muted"
            >
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold leading-tight">{name}</p>
                {profile?.is_admin && (
                  <p className="text-xs leading-tight text-muted-foreground">
                    PSLA Admin
                  </p>
                )}
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
