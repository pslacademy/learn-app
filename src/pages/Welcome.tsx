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
import { checkAccount, createAccount } from "@/lib/account";
import { useToast } from "@/hooks/use-toast";

/**
 * Where somebody lands after registering on the website.
 *
 * Two steps, deliberately. First the address is checked against the CRM, so
 * a person who mistyped it, or used a different address from the one they
 * registered with, is told before they have chosen a password. Then they set
 * one and are signed straight in.
 *
 * Public by necessity: this is where an account is created, so it cannot sit
 * behind a session that does not exist yet. Reaching it grants nothing,
 * because the registration is checked server side.
 */

type Step = "email" | "password";

const Welcome = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  // The GoHighLevel form can pass the address through on the redirect. It is
  // a prefill and nothing more: identity is established by the CRM check
  // below, never by what is in the address bar.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("email");
    if (fromUrl) setEmail(fromUrl);
  }, []);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBusy(true);

    const result = await checkAccount(email);
    setIsBusy(false);

    if (result.hasAccount) {
      toast({
        title: "You already have an account",
        description: "Sign in with your password, or reset it if you have forgotten it.",
      });
      navigate(`/login?email=${encodeURIComponent(email.trim())}`);
      return;
    }

    // null means the CRM could not be reached, which is not the same as
    // saying there is no registration. Never turn somebody away on that.
    if (result.enrolled === null) {
      toast({
        variant: "destructive",
        title: "We could not check just now",
        description: "Please try again in a moment.",
      });
      return;
    }

    if (result.enrolled === false) {
      toast({
        variant: "destructive",
        title: "No registration found for that address",
        description:
          "Join the community first, or use the address you registered with.",
      });
      return;
    }

    setFirstName(result.firstName);
    setLastName(result.lastName);
    setStep("password");
  };

  const handleCreate = async (e: React.FormEvent) => {
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
    const result = await createAccount(email, password, firstName, lastName);
    setIsBusy(false);

    if (!result.ok) {
      if (result.code === "already_registered") {
        toast({
          title: "You already have an account",
          description: result.error,
        });
        navigate(`/login?email=${encodeURIComponent(email.trim())}`);
        return;
      }
      toast({
        variant: "destructive",
        title: "Could not create your account",
        description: result.error,
      });
      return;
    }

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
              {step === "email" ? "Set up your account" : `Welcome, ${firstName || "there"}`}
            </h1>
            <p className="text-sm text-muted-foreground">
              {step === "email"
                ? "Enter the email address you registered with."
                : "Choose a password and you are in."}
            </p>
          </div>
        </div>

        {step === "email" ? (
          <form onSubmit={handleCheck} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                required
                className="h-11"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isBusy}
              />
            </div>
            <Button
              type="submit"
              className="h-11 w-full text-base font-semibold"
              disabled={isBusy}
            >
              {isBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleCreate} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
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
                <Label htmlFor="confirm">Confirm password</Label>
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
                  Creating your account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>
        )}

        <div className="mt-6 text-center text-sm">
          <span className="text-muted-foreground">Already set a password? </span>
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        <a
          href={BRAND.links.registrationPage}
          className="hover:text-foreground"
          target="_blank"
          rel="noopener noreferrer"
        >
          Not registered yet? Join the PSLA Community
        </a>
      </p>
    </div>
  );
};

export default Welcome;
