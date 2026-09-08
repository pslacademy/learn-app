import { ReactNode, useEffect, useRef, useState } from "react";
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

export interface MentionCandidate {
  id: string;
  name: string;
  title?: string | null;
}

interface EditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  id?: string;
  /**
   * Who may be mentioned here. Only people the database will actually notify:
   * offering a name that cannot be notified is worse than offering none,
   * because the writer would assume the person had been told.
   */
  mentions?: MentionCandidate[];
}

export const RichTextEditor = ({
  value,
  onChange,
  placeholder,
  rows = 5,
  id,
  mentions = [],
}: EditorProps) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  const [query, setQuery] = useState<string | null>(null);

  /*
    Watch what is being typed after an @, up to the cursor. Closed as soon as
    the word contains something that could not be part of a name, so a stray @
    in an address does not leave a menu hanging open.
  */
  const updateMention = (text: string, caret: number) => {
    const upToCaret = text.slice(0, caret);
    const at = upToCaret.lastIndexOf("@");
    if (at === -1) return setQuery(null);

    const after = upToCaret.slice(at + 1);
    if (after.includes("\n") || after.length > 30) return setQuery(null);
    // A name is words and spaces. Anything else means they have moved on.
    if (!/^[\p{L}\s'-]*$/u.test(after)) return setQuery(null);

    setQuery(after);
  };

  const insertMention = (name: string) => {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart;
    const at = value.slice(0, caret).lastIndexOf("@");
    if (at === -1) return;

    const next = value.slice(0, at) + "@" + name + " " + value.slice(caret);
    onChange(next);
    setQuery(null);

    requestAnimationFrame(() => {
      el.focus();
      const pos = at + name.length + 2;
      el.setSelectionRange(pos, pos);
    });
  };

  const matches =
    query === null
      ? []
      : mentions
          .filter((m) => m.name.toLowerCase().includes(query.trim().toLowerCase()))
          .slice(0, 6);

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
        <div className="relative">
          <Textarea
            id={id}
            ref={ref}
            rows={rows}
            placeholder={placeholder}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              updateMention(e.target.value, e.target.selectionStart);
            }}
            onKeyUp={(e) =>
              updateMention(
                (e.target as HTMLTextAreaElement).value,
                (e.target as HTMLTextAreaElement).selectionStart,
              )
            }
            onBlur={() => window.setTimeout(() => setQuery(null), 150)}
            className="rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />

          {matches.length > 0 && (
            <div className="absolute bottom-2 left-2 z-20 w-64 overflow-hidden rounded-md border bg-popover shadow-md">
              {matches.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onMouseDown={(e) => {
                    // mousedown, not click: blur would close the menu first.
                    e.preventDefault();
                    insertMention(m.name);
                  }}
                  className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="font-medium">{m.name}</span>
                  {m.title && (
                    <span className="text-xs text-muted-foreground">{m.title}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="border-t bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        Select text and use the buttons, or write Markdown.
        {mentions.length > 0 ? " Type @ to mention someone." : ""} Links open in
        a new tab.
      </p>
    </div>
  );
};
