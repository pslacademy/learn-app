import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";
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
 * One screen: name, address, password. The registration is confirmed against
 * the CRM in the background while they type, so anyone who used a different
 * address is told before they have chosen a password rather than after.
 *
 * Nothing here decides entitlement. The address in the URL is a prefill and
 * never an identity, and the account is only created once the server has
 * found the contact itself.
 *
 * The profile itself is filled in afterwards, at /settings?setup=true, which
 * is the same screen they will return to whenever they want to change it.
 * A separate one-off wizard would teach them a place that then disappears.
 */
const Welcome = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const [checking, setChecking] = useState(false);
  /** true registered, false not found, null not asked or unreachable */
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [hasAccount, setHasAccount] = useState(false);

  const runCheck = async (address: string) => {
    const clean = address.trim();
    if (!clean || !clean.includes("@")) return;

    setChecking(true);
    const result = await checkAccount(clean);
    setChecking(false);

    setEnrolled(result.enrolled);
    setHasAccount(result.hasAccount);
    if (result.firstName) setFirstName(result.firstName);
    if (result.lastName) setLastName(result.lastName);
  };

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("email");
    if (fromUrl) {
      setEmail(fromUrl);
      runCheck(fromUrl);
    }
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
    const result = await createAccount(email, password, firstName, lastName);
    setIsBusy(false);

    if (!result.ok) {
      if (result.code === "already_registered") {
        toast({ title: "You already have an account", description: result.error });
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

    // Straight to the real settings screen, in setup mode.
    navigate("/settings?setup=true");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-[520px] rounded-2xl border bg-card p-8 shadow-sm md:p-10">
        <div className="mb-8 flex flex-col items-center space-y-4">
          <img
            src={BRAND.marks.logo}
            alt={BRAND.organisation}
            className="h-12 w-auto object-contain"
          />
          <div className="space-y-2 text-center">
            <h1 className="flex items-center justify-center gap-2 text-2xl font-bold tracking-tight text-foreground">
              <ShieldCheck className="h-6 w-6 text-primary" aria-hidden="true" />
              Secure your account
            </h1>
            <p className="text-sm text-muted-foreground">
              Welcome to {BRAND.name}. Choose a password so you can sign back in
              whenever you like.
            </p>
          </div>
        </div>

        {hasAccount && (
          <div className="mb-6 flex gap-3 rounded-lg border bg-muted/60 p-4 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
            <p>
              You already have an account for that address. There is no need to
              set a password again.{" "}
              <Link
                to={`/login?email=${encodeURIComponent(email.trim())}`}
                className="font-medium text-primary hover:underline"
              >
                Sign in
              </Link>
              .
            </p>
          </div>
        )}

        {enrolled === false && !hasAccount && (
          <div className="mb-6 flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
            <p>
              We could not find a registration for that address. Use the address
              you registered with, or{" "}
              <a
                href={BRAND.links.registrationPage}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                join the PSLA Community
              </a>{" "}
              first.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first-name">First name</Label>
              <Input
                id="first-name"
                required
                className="h-11"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={isBusy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last-name">Last name</Label>
              <Input
                id="last-name"
                required
                className="h-11"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={isBusy}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              required
              placeholder="name@example.com"
              className="h-11"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEnrolled(null);
                setHasAccount(false);
              }}
              onBlur={(e) => runCheck(e.target.value)}
              disabled={isBusy}
            />
            {checking && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Checking your registration...
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="password">Create password</Label>
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

          <PasswordRequirements
            value={password}
            className="rounded-lg bg-muted/60 p-4"
          />

          <Button
            type="submit"
            className="h-11 w-full text-base font-semibold"
            disabled={isBusy || hasAccount || !isPasswordValid(password)}
          >
            {isBusy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating your account...
              </>
            ) : (
              <>
                <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                Complete account setup
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <span className="text-muted-foreground">Already set a password? </span>
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Welcome;
