import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PasswordRequirements,
  isPasswordValid,
  firstPasswordProblem,
} from "@/components/PasswordRequirements";
import { BRAND } from "@/config/brand";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

/**
 * Where the emailed reset link lands.
 *
 * Supabase turns the link into a recovery session before this page renders,
 * so the member is briefly signed in with the sole right to set a password.
 * Public by necessity: somebody who has forgotten their password cannot be
 * asked to sign in before they can choose a new one.
 */

type State = "checking" | "ready" | "invalid";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [state, setState] = useState<State>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    /*
      An expired or already-used link produces no session, and the member
      would otherwise see a password form that fails on submit for reasons
      nobody explains. Checked up front instead.
    */
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setState(data?.session ? "ready" : "invalid");
    };

    // The recovery session may land a moment after the page does.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !cancelled) setState("ready");
    });

    check();

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const problem = firstPasswordProblem(password);
    if (problem) {
      toast({
        variant: "destructive",
        title: "Your password needs a change",
        description: problem,
      });
      return;
    }

    if (password !== confirm) {
      toast({
        variant: "destructive",
        title: "The two passwords do not match",
        description: "Type the same password in both boxes.",
      });
      return;
    }

    setIsBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsBusy(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Could not set your password",
        description: error.message,
      });
      return;
    }

    toast({
      title: "Password changed",
      description: "You are signed in.",
    });
    navigate("/dashboard");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-[460px] rounded-2xl border bg-card p-8 shadow-sm md:p-10">
        <div className="mb-8 flex flex-col items-center space-y-4">
          <img
            src={BRAND.marks.logo}
            alt={BRAND.organisation}
            className="h-12 w-auto object-contain"
          />
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Choose a new password
            </h1>
          </div>
        </div>

        {state === "checking" && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {state === "invalid" && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              This link has expired or has already been used. Reset links can
              only be used once.
            </p>
            <Button asChild className="h-11 w-full text-base font-semibold">
              <Link to="/login">Request a new link</Link>
            </Button>
          </div>
        )}

        {state === "ready" && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  className="h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isBusy}
                />
              </div>
              <PasswordRequirements value={password} className="rounded-lg bg-muted/60 p-4" />
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
            </div>
            <Button
              type="submit"
              className="h-11 w-full text-base font-semibold"
              disabled={isBusy || !isPasswordValid(password)}
            >
              {isBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Set password"
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
