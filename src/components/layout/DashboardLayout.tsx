import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { BRAND } from "@/config/brand";

interface DashboardLayoutProps {
  children: ReactNode;
  fullWidth?: boolean;
  noPadding?: boolean;
}

export function DashboardLayout({
  children,
  fullWidth = false,
  noPadding = false,
}: DashboardLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main
          className={`flex-1 overflow-y-auto ${noPadding ? "" : "p-4 md:p-8 lg:p-10"}`}
        >
          <div
            className={`${fullWidth ? "" : "mx-auto max-w-6xl"} flex min-h-[calc(100vh-8rem)] flex-col`}
          >
            <div className={`flex-1 ${fullWidth ? "w-full" : ""}`}>{children}</div>

            <footer
              className={`${noPadding ? "mt-0" : "mt-12"} flex flex-col items-center justify-between gap-8 border-t border-border/40 py-8 text-sm text-muted-foreground md:flex-row ${noPadding ? "px-4 md:px-8 lg:px-10" : ""}`}
            >
              <div className="flex flex-1 justify-start">
                <img
                  src={BRAND.marks.logo}
                  alt={BRAND.organisation}
                  className="h-12 w-auto opacity-80 transition-opacity hover:opacity-100"
                />
              </div>
              <div className="flex flex-[2] justify-center text-center">
                <span>
                  © {new Date().getFullYear()} {BRAND.organisation}. All rights
                  reserved.
                </span>
              </div>
              <div className="flex flex-1 justify-end gap-6">
                <a
                  href={BRAND.links.terms}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-primary"
                >
                  Terms
                </a>
                <a
                  href={BRAND.links.privacy}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-primary"
                >
                  Privacy
                </a>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
