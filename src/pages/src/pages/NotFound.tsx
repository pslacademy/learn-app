import { useLocation } from "react-router-dom";

/**
 * Reached only when the SPA rewrite worked and React Router had no match.
 * If a deep link shows Vercel's own 404 instead of this page, the rewrite
 * in vercel.json is not being applied.
 */
const NotFound = () => {
  const { pathname } = useLocation();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-bold text-secondary">Page not found</h1>
      <p className="text-muted-foreground">
        Nothing is routed at <code className="font-mono">{pathname}</code> yet.
      </p>
      <p className="text-xs text-muted-foreground">
        Seeing this page means the SPA rewrite is working.
      </p>
    </main>
  );
};

export default NotFound;
