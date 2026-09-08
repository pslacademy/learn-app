import { ReactNode, useRef, useState } from "react";
import { Bold, Italic, Link2, List, ListOrdered, Eye, EyeOff } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Markdown, written and displayed.
 *
 * The toolbar writes Markdown into the text rather than holding a separate
 * rich document, so what is stored is exactly what was typed. Somebody who
 * knows Markdown can ignore the buttons entirely, and nothing is lost when
 * the text is read somewhere that has no formatting at all.
 *
 * The renderer builds React elements rather than setting HTML. A post is
 * written by a member, and handing member-written text to dangerouslySetInner
 * HTML is how a community feed becomes a way to run scripts on everybody
 * else's screen. Building elements means a stray tag is shown as text, which
 * is the safe failure.
 */

/* ── Rendering ─────────────────────────────────────────────────────── */

/** Bold, italic and links, in that order of precedence. */
const inline = (text: string, keyPrefix: string): ReactNode[] => {
  const out: ReactNode[] = [];
  let rest = text;
  let i = 0;

  const patterns: {
    re: RegExp;
    render: (m: RegExpMatchArray, key: string) => ReactNode;
  }[] = [
    {
      re: /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/,
      render: (m, key) => (
        <a
          key={key}
          href={m[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {m[1]}
        </a>
      ),
    },
    {
      re: /\*\*([^*]+)\*\*/,
      render: (m, key) => <strong key={key}>{m[1]}</strong>,
    },
    {
      re: /(?<!\*)\*([^*]+)\*(?!\*)/,
      render: (m, key) => <em key={key}>{m[1]}</em>,
    },
  ];

  while (rest.length > 0) {
    let earliest: { index: number; match: RegExpMatchArray; p: (typeof patterns)[0] } | null =
      null;

    for (const p of patterns) {
      const m = rest.match(p.re);
      if (m && m.index !== undefined && (!earliest || m.index < earliest.index)) {
        earliest = { index: m.index, match: m, p };
      }
    }

    if (!earliest) {
      out.push(rest);
      break;
    }

    if (earliest.index > 0) out.push(rest.slice(0, earliest.index));
    out.push(earliest.p.render(earliest.match, `${keyPrefix}-${i++}`));
    rest = rest.slice(earliest.index + earliest.match[0].length);
  }

  return out;
};

export const Markdown = ({ text }: { text: string }) => {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = (key: string) => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag
        key={key}
        className={cn(
          "my-2 space-y-1 pl-6",
          list.ordered ? "list-decimal" : "list-disc",
        )}
      >
        {list.items.map((item, i) => (
          <li key={i}>{inline(item, `${key}-${i}`)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };

  lines.forEach((line, i) => {
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);

    if (bullet) {
      if (list && list.ordered) flush(`l${i}`);
      list = list ?? { ordered: false, items: [] };
      list.items.push(bullet[1]);
      return;
    }
    if (numbered) {
      if (list && !list.ordered) flush(`l${i}`);
      list = list ?? { ordered: true, items: [] };
      list.items.push(numbered[1]);
      return;
    }

    flush(`l${i}`);
    if (line.trim() === "") return;
    blocks.push(
      <p key={`p${i}`} className="my-1">
        {inline(line, `p${i}`)}
      </p>,
    );
  });

  flush("last");

  return <div className="text-sm leading-relaxed">{blocks}</div>;
};

/* ── Writing ───────────────────────────────────────────────────────── */

interface EditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  id?: string;
}

export const RichTextEditor = ({
  value,
  onChange,
  placeholder,
  rows = 5,
  id,
}: EditorProps) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  /**
   * Wrap the selection, or insert the marker where the cursor is.
   *
   * The caret is put back afterwards, inside the marker when nothing was
   * selected, so pressing Bold and typing does what everyone expects.
   */
  const wrap = (before: string, after = before) => {
    const el = ref.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const next = value.slice(0, start) + before + selected + after + value.slice(end);

    onChange(next);

    requestAnimationFrame(() => {
      el.focus();
      const caret = start + before.length + selected.length;
      el.setSelectionRange(caret, caret);
    });
  };

  /** Prefix each selected line, so a list can be made from several lines. */
  const prefixLines = (marker: (i: number) => string) => {
    const el = ref.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const chunk = value.slice(lineStart, end) || "";
    const prefixed = chunk
      .split("\n")
      .map((l, i) => (l.trim() ? `${marker(i)}${l}` : l))
      .join("\n");

    onChange(value.slice(0, lineStart) + prefixed + value.slice(end));
    requestAnimationFrame(() => el.focus());
  };

  const tools = [
    { icon: Bold, label: "Bold", run: () => wrap("**") },
    { icon: Italic, label: "Italic", run: () => wrap("*") },
    { icon: Link2, label: "Link", run: () => wrap("[", "](https://)") },
    { icon: List, label: "Bullet list", run: () => prefixLines(() => "- ") },
    {
      icon: ListOrdered,
      label: "Numbered list",
      run: () => prefixLines((i) => `${i + 1}. `),
    },
  ];

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b bg-muted/40 px-2 py-1">
        <div className="flex items-center gap-1">
          {tools.map((t) => (
            <Button
              key={t.label}
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={t.label}
              onClick={t.run}
            >
              <t.icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setPreview((p) => !p)}
        >
          {preview ? (
            <EyeOff className="mr-2 h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          {preview ? "Write" : "Preview"}
        </Button>
      </div>

      {preview ? (
        <div className="min-h-[8rem] p-3">
          {value.trim() ? (
            <Markdown text={value} />
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
          )}
        </div>
      ) : (
        <Textarea
          id={id}
          ref={ref}
          rows={rows}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      )}

      <p className="border-t bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        Select text and use the buttons, or write Markdown. Links open in a new
        tab.
      </p>
    </div>
  );
};
