import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Mail,
  MessageSquare,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BRAND } from "@/config/brand";
import { useToast } from "@/hooks/use-toast";

/**
 * Support.
 *
 * Three routes, in the order somebody should try them: ask the community,
 * read the answer to a question somebody has already asked, or write to us.
 * A support form first would mean answering the same five questions forever.
 *
 * The questions are written here rather than stored. There are five of them,
 * they change rarely, and a table plus an admin screen to edit five
 * paragraphs is more machinery than the problem deserves. When there are
 * twenty, that changes.
 */
const FAQS: { q: string; a: string }[] = [
  {
    q: "How do I access my certificate?",
    a: "Certificates appear under Achievements once you have completed every module of a course. Each one can be downloaded as a PDF and carries a credential ID, which is worth keeping if you are asked to prove it.",
  },
  {
    q: "Can I pause a course and come back to it?",
    a: "Yes. Every course is self-paced and your progress is saved as you go, on whichever device you are using. Pick it up whenever suits.",
  },
  {
    q: "How do I join the conversation with other members?",
    a: "Community, in the sidebar, is your space. Ask a Question is for anything you are stuck on, and Share a Win is for the things that went well. The Members Directory shows who else is in your community.",
  },
  {
    q: "When are the live sessions held?",
    a: "Everything scheduled is under Events, with the time shown in the session's own timezone and your own alongside it when they differ. Add to calendar puts it in your diary, and recordings appear under Replays afterwards.",
  },
  {
    q: "I am having trouble playing a video.",
    a: "Check your connection first, then try clearing your browser cache or a different browser: Chrome and Safari are the ones we test. If it still will not play, send us a support request below and tell us which lesson it is.",
  },
];

const Support = () => {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const formHost = useRef<HTMLDivElement>(null);

  /*
    GoHighLevel's embed script rewrites the iframe once it loads, chiefly to
    size it to its content. Loaded once and left in place: adding it on every
    visit stacks up listeners and the form starts to lag.
  */
  useEffect(() => {
    const existing = document.querySelector(
      `script[src="${BRAND.links.formLoader}"]`,
    );
    if (existing) return;

    const script = document.createElement("script");
    script.src = BRAND.links.formLoader;
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      window.setTimeout(() => setCopied(null), 2000);
    } catch (_) {
      /* Clipboard access is refused in some browsers, and telling somebody
         to select the address themselves is better than a button that
         silently does nothing. */
      toast({
        title: "Could not copy",
        description: "Select the address and copy it manually.",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Support</h1>
          <p className="mt-1 text-muted-foreground">
            How can we help you today?
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ---- Left: ask the room, then read the answers ---- */}
          <div className="space-y-6">
            <Card className="bg-muted/40">
              <CardContent className="space-y-3 p-6">
                <MessageSquare
                  className="h-6 w-6 text-primary"
                  aria-hidden="true"
                />
                <h2 className="text-xl font-bold">Ask the community</h2>
                <p className="text-sm text-muted-foreground">
                  Somebody in your community has usually been where you are.
                  Questions there are often answered faster than we can get to
                  them, and everybody else gets the answer too.
                </p>
                <Button asChild variant="outline">
                  <Link to="/community?space=questions">
                    Ask a question
                    <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h2 className="text-xl font-bold">Frequently asked questions</h2>
              <Accordion type="single" collapsible className="w-full">
                {FAQS.map((item, i) => (
                  <AccordionItem key={i} value={`faq-${i}`}>
                    <AccordionTrigger className="text-left">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>

          {/* ---- Right: write to us ---- */}
          <div className="space-y-6">
            <Card>
              <CardContent className="space-y-4 p-6">
                <div>
                  <h2 className="text-xl font-bold">Send us a request</h2>
                  <p className="text-sm text-muted-foreground">
                    Tell us what is happening and we will come back to you.
                  </p>
                </div>

                <div ref={formHost} className="overflow-hidden rounded-lg border">
                  <iframe
                    src={BRAND.links.supportForm}
                    title="PSL Academy support form"
                    id="psla-support-form"
                    className="h-[560px] w-full border-0"
                  />
                </div>

                <p className="text-sm text-muted-foreground">
                  Prefer email?{" "}
                  <button
                    type="button"
                    onClick={() => copy(BRAND.support.email)}
                    className="font-medium text-primary hover:underline"
                  >
                    {BRAND.support.email}
                  </button>
                </p>
              </CardContent>
            </Card>

            <Card className="bg-muted/40">
              <CardContent className="space-y-3 p-6">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
                  <h2 className="text-lg font-bold">Billing and invoices</h2>
                </div>

                <p className="text-sm text-muted-foreground">
                  For anything to do with payments, write to the accounts team
                  directly.
                </p>

                <div className="flex items-center gap-2">
                  <code className="rounded bg-background px-2 py-1 text-sm">
                    {BRAND.support.accountsEmail}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Copy the accounts email address"
                    onClick={() => copy(BRAND.support.accountsEmail)}
                  >
                    {copied === BRAND.support.accountsEmail ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Said plainly, because an invoice from a name they do not
                    recognise is the most common reason somebody writes in
                    about billing at all. */}
                <p className="text-xs text-muted-foreground">
                  {BRAND.support.accountsNote}
                </p>

                <p className="text-xs text-muted-foreground">
                  {BRAND.support.accountsHours}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Support;
