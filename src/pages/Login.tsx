import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RegistrationModal } from "@/components/RegistrationModal";
import { BRAND } from "@/config/brand";
import { signInWithPassword, sendPasswordReset, syncFromCrm } from "@/lib/account";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleForgotPassword = async () => {
    const address = email.trim();
    if (!address) {
      toast({
        variant: "destructive",
        title: "Enter your email first",
        description:
          "Type your email address above, then choose Forgot password.",
      });
      return;
    }

    setIsSendingReset(true);
    await sendPasswordReset(address);
    setIsSendingReset(false);

    // Deliberately the same message whether or not the address is known, so
    // this cannot be used to discover who has an account.
    toast({
      title: "Check your email",
      description:
        "If that address has an account, a link to reset your password is on its way.",
    });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Somebody sent here from /welcome because they already have an account
    // should not have to retype the address they just entered.
    const fromUrl = params.get("email");
    if (fromUrl) setEmail(fromUrl);

    // Sent here by ProtectedRoute because the account is no longer active.
    // Told plainly, rather than being allowed to sign in again and bounced
    // straight back out with no explanation.
    if (params.get("suspended")) {
      toast({
        variant: "destructive",
        title: "This account is no longer active",
        description:
          "Your academy membership has ended. If you think that is a mistake, please get in touch.",
      });
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signInWithPassword(email, password);

      if (result.ok) {
        // Bring the record up to date from their CRM tags. Nothing here is
        // taken from the browser.
        await syncFromCrm();
        navigate("/dashboard");
      } else {
        toast({
          variant: "destructive",
          title: "Could not sign you in",
          description: result.error,
        });
      }
    } catch (_) {
      toast({
        variant: "destructive",
        title: "Connection problem",
        description:
          "We could not sign you in just now. Please try again shortly.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-[420px] rounded-2xl border bg-card p-8 shadow-sm md:p-10">
          <div className="mb-8 flex flex-col items-center space-y-4">
            <img
              src={BRAND.marks.logo}
              alt={BRAND.organisation}
              className="h-12 w-auto object-contain"
            />
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Welcome back
              </h1>
              <p className="text-sm text-muted-foreground">
                Sign in to {BRAND.name}.
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
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
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={isSendingReset}
                    className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    {isSendingReset ? "Sending..." : "Forgot password?"}
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  className="h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>
            <Button
              type="submit"
              className="h-11 w-full text-base font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          {/* Somebody who has registered on the website but never chose a
              password lands here from an email and would otherwise be stuck:
              they have no credentials to enter and no obvious way forward. */}
          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">
              Registered but haven't set a password yet?{" "}
            </span>
            <Link
              to={email ? `/welcome?email=${encodeURIComponent(email)}` : "/welcome"}
              className="font-medium text-primary hover:underline"
            >
              Set your password
            </Link>
          </div>

          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">Not a member yet? </span>
            <button
              type="button"
              onClick={() => setIsRegistrationOpen(true)}
              className="font-medium text-primary hover:underline"
              disabled={isLoading}
            >
              Join for free
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <a
            href={BRAND.links.site}
            className="hover:text-foreground"
            target="_blank"
            rel="noopener noreferrer"
          >
            {BRAND.organisation}
          </a>
        </p>
      </div>

      <RegistrationModal
        isOpen={isRegistrationOpen}
        onClose={() => setIsRegistrationOpen(false)}
      />
    </>
  );
};

export default Login;
