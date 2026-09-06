import { ReactNode, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Confirm before deleting.
 *
 * Deletions are written straight to the database rather than held until Save
 * all changes, so there is no unsaved state to abandon and nothing to undo.
 * A cascade makes that worse: deleting a course takes its modules, its
 * lessons and every member's progress on it with it.
 *
 * The name of the thing is repeated in the message on purpose. "Delete this
 * module?" is answered yes by someone who has the wrong module selected;
 * "Delete Module 2 - Emotions 101?" is not.
 */
interface Props {
  /** The button that opens the confirmation. */
  children: ReactNode;
  /** What is being deleted, named. */
  name: string;
  /** What else goes with it. Omit when nothing does. */
  consequence?: string;
  onConfirm: () => void | Promise<void>;
}

export const ConfirmDelete = ({
  children,
  name,
  consequence,
  onConfirm,
}: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {consequence ? `${consequence} ` : ""}
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              setOpen(false);
              await onConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmDelete;
