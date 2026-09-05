import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PasswordRequirements,
  isPasswordValid,
  firstPasswordProblem,
} from "@/components/PasswordRequirements";
import { BRAND } from "@/config/brand";
import { changePassword, signOut } from "@/lib/account";
import { useToast } from "@/hooks/use-toast";

/**
 * Settings, Security section.
 *
 * Profile, notifications and messaging preferences arrive with the phases
 * that give them somewhere to matter. Changing a password is needed the
 * moment there are accounts, so it is here now.
 */
const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const problem = firstPasswordProblem(next);
    if (problem) {
      toast({
        variant: "destructive",
        title: "Your new password needs a change",
        description: problem,
      });
      return;
    }

    if (next !== confirm) {
      toast({
        variant: "destructive",
        title: "The two passwords do not match",
        description: "Type the same password in both boxes.",
      });
      return;
    }

    if (next === current) {
      toast({
        variant: "destructive",
        title: "That is your current password",
        description: "Choose a different one.",
      });
      return;
    }

    setIsBusy(true);
    const result = await changePassword(current, next);
    setIsBusy(false);

    if (!result.ok) {
      toast({
        variant: "destructive",
        title: "Could not change your password",
        description: result.error,
      });
      return;
    }

    setCurrent("");
    setNext("");
    setConfirm("");

    toast({
      title: "Password changed",
      description: "Please sign in again with your new password.",
    });

    // Signed out on purpose. A password change on a borrowed or shared
    // machine should not leave the old session usable.
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            to="/dashboard"
            className="flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Back
          </Link>
          <img
            src={BRAND.marks.logo}
            alt={BRAND.organisation}
            className="h-8 w-auto object-contain"
          />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>

        <section className="mt-6 rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Security</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Change your password. You will be signed out afterwards.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 max-w-sm space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current">Current password</Label>
              <Input
                id="current"
                type="password"
                required
                className="h-11"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                disabled={isBusy}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="next">New password</Label>
              <Input
                id="next"
                type="password"
                required
                className="h-11"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                disabled={isBusy}
              />
            </div>

            <PasswordRequirements value={next} className="rounded-lg bg-muted/60 p-4" />

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                required
                className="h-11"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={isBusy}
              />
            </div>

            <Button
              type="submit"
              className="h-11 w-full text-base font-semibold"
              disabled={isBusy || !current || !isPasswordValid(next)}
            >
              {isBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Changing...
                </>
              ) : (
                "Change password"
              )}
            </Button>
          </form>
        </section>
      </main>
    </div>
  );
};

export default Settings;
