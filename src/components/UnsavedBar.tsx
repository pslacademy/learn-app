import { useEffect } from "react";
import { Loader2, Save, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Unsaved changes, said out loud.
 *
 * The save button used to sit at the top or the bottom of a long form, so
 * changing a switch in the middle of it left no visible way to save and no
 * sign that anything needed saving. Somebody turned off direct messages,
 * navigated away, and the change was simply lost.
 *
 * A bar fixed to the bottom of the window solves that at the moment it
 * matters. The browser warning underneath is only a backstop for closing the
 * tab: it is deliberately not the main mechanism, because a dialog that
 * appears after somebody has decided to leave is a poor substitute for
 * telling them while they are still looking at the form.
 *
 * It does not catch moving to another page inside the academy. React Router
 * cannot intercept that without restructuring how the whole app routes, and
 * the bar makes it unlikely enough that the restructuring is not worth it
 * today.
 */
interface Props {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  /** What is unsaved, e.g. "profile". Shown in the message. */
  what?: string;
}

export const UnsavedBar = ({ dirty, saving, onSave, onDiscard, what }: Props) => {
  useEffect(() => {
    if (!dirty) return;

    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Browsers ignore custom text now and show their own wording. Setting
      // returnValue is what still triggers the dialog.
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!dirty) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-card/95 shadow-lg backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
        <p className="text-sm font-medium">
          You have unsaved changes{what ? ` to your ${what}` : ""}.
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onDiscard} disabled={saving}>
            <Undo2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Discard
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UnsavedBar;
