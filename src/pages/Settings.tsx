import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  PasswordRequirements,
  isPasswordValid,
  firstPasswordProblem,
} from "@/components/PasswordRequirements";
import { BRAND } from "@/config/brand";
import {
  changePassword,
  getProfile,
  signOut,
  updateProfile,
} from "@/lib/account";
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

  const [loading, setLoading] = useState(true);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [allowMessaging, setAllowMessaging] = useState(false);
  const [notifyCourseUpdates, setNotifyCourseUpdates] = useState(true);
  const [notifyCommunityMentions, setNotifyCommunityMentions] = useState(true);
  const [notifyMarketing, setNotifyMarketing] = useState(false);

  // Read the saved values rather than showing the defaults, so the switches
  // reflect what is actually stored and saving does not quietly reset them.
  useEffect(() => {
    getProfile().then((p) => {
      if (p) {
        setFirstName(p.first_name ?? "");
        setLastName(p.last_name ?? "");
        setTitle(p.title ?? "");
        setLocation(p.location ?? "");
        setBio(p.bio ?? "");
        setAllowMessaging(p.allow_messaging);
        setNotifyCourseUpdates(p.notify_course_updates);
        setNotifyCommunityMentions(p.notify_community_mentions);
        setNotifyMarketing(p.notify_marketing);
      }
      setLoading(false);
    });
  }, []);

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    const result = await updateProfile({ firstName, lastName, title, location, bio });
    setIsSavingProfile(false);

    if (!result.ok) {
      toast({
        variant: "destructive",
        title: "Could not save your profile",
        description: result.error,
      });
      return;
    }

    /*
      Saved here, and separately reported on whether it reached the CRM.
      Silently succeeding when only half of it worked is how a member ends
      up with two different names in two systems and nobody notices.
    */
    toast(
      result.crmSynced
        ? { title: "Profile saved" }
        : {
            title: "Profile saved",
            description:
              "Our records could not be updated just now. Your academy profile is correct and we will catch up.",
          },
    );
  };

  const handleSavePreferences = async () => {
    setIsSavingPrefs(true);
    const result = await updateProfile({
      allowMessaging,
      notifyCourseUpdates,
      notifyCommunityMentions,
      notifyMarketing,
    });
    setIsSavingPrefs(false);

    toast(
      result.ok
        ? { title: "Saved" }
        : {
            variant: "destructive",
            title: "Could not save",
            description: result.error,
          },
    );
  };

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
          <h2 className="text-lg font-semibold text-foreground">Your profile</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            How you appear to other members. Your name and these details are
            also kept in step with our records.
          </p>

          {loading ? (
            <Loader2 className="mt-6 h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <div className="mt-6 max-w-md space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First name</Label>
                  <Input
                    id="first-name"
                    className="h-11"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={isSavingProfile}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name">Last name</Label>
                  <Input
                    id="last-name"
                    className="h-11"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={isSavingProfile}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Professional title</Label>
                <Input
                  id="title"
                  className="h-11"
                  placeholder="Partner, Corporate Advisory"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isSavingProfile}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  className="h-11"
                  placeholder="Sydney, Australia"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={isSavingProfile}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">About you</Label>
                <Textarea
                  id="bio"
                  rows={5}
                  placeholder="A few lines about your work and what you are here to learn."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  disabled={isSavingProfile}
                />
              </div>

              <Button
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="h-11"
              >
                {isSavingProfile ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save profile"
                )}
              </Button>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">
            Messaging and notifications
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The choices you made when you set up your account.
          </p>

          {loading ? (
            <Loader2 className="mt-6 h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <div className="mt-6 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="allow-messaging">Allow direct messages</Label>
                  <p className="text-sm text-muted-foreground">
                    Let other members message you privately.
                  </p>
                </div>
                <Switch
                  id="allow-messaging"
                  checked={allowMessaging}
                  onCheckedChange={setAllowMessaging}
                />
              </div>

              <div className="space-y-5 border-t pt-6">
                <p className="text-sm font-medium">Email me about</p>

                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="notify-courses">Course updates</Label>
                    <p className="text-sm text-muted-foreground">
                      New modules, resources and live coaching sessions.
                    </p>
                  </div>
                  <Switch
                    id="notify-courses"
                    checked={notifyCourseUpdates}
                    onCheckedChange={setNotifyCourseUpdates}
                  />
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="notify-community">Community replies</Label>
                    <p className="text-sm text-muted-foreground">
                      When someone replies to you or mentions you.
                    </p>
                  </div>
                  <Switch
                    id="notify-community"
                    checked={notifyCommunityMentions}
                    onCheckedChange={setNotifyCommunityMentions}
                  />
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="notify-marketing">Offers and news</Label>
                    <p className="text-sm text-muted-foreground">
                      Occasional promotions and announcements.
                    </p>
                  </div>
                  <Switch
                    id="notify-marketing"
                    checked={notifyMarketing}
                    onCheckedChange={setNotifyMarketing}
                  />
                </div>
              </div>

              <Button
                onClick={handleSavePreferences}
                disabled={isSavingPrefs}
                className="h-11"
              >
                {isSavingPrefs ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save preferences"
                )}
              </Button>
            </div>
          )}
        </section>

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
