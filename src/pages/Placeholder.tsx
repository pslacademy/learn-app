import { BRAND } from "@/config/brand";

const Placeholder = () => (
  <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted px-6 text-center">
    <img src={BRAND.marks.logo} alt={BRAND.organisation} className="h-16" />
    <h1 className="text-3xl font-bold text-secondary">{BRAND.name}</h1>
    <p className="max-w-md text-muted-foreground">
      The academy is being built. There is nothing to sign in to yet.
    </p>
    <div className="flex gap-3">
      <span className="h-8 w-8 rounded bg-primary" title="Primary #F58220" />
      <span className="h-8 w-8 rounded bg-secondary" title="Secondary #2C3E50" />
      <span className="h-8 w-8 rounded border border-border bg-background" title="Border #DAE0E7" />
    </div>
    <p className="text-xs text-muted-foreground">
      Phase 1 skeleton, {BRAND.domain}
    </p>
  </main>
);

export default Placeholder;
