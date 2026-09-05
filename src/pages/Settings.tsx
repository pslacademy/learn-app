import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles, CheckCircle2, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { COUNTRIES, TIMEZONES } from "@/data/geo";
import { updateProfile, getProfile, changePassword, signOut } from "@/lib/account";
import {
  PasswordRequirements,
  isPasswordValid,
  firstPasswordProblem,
} from "@/components/PasswordRequirements";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

/** Largest avatar we will accept, in bytes. */
const MAX_AVATAR_BYTES = 800 * 1024;

const Settings = () => {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(location.search);
  /* Arriving straight from /welcome. The banner is the whole difference:
     the screen is otherwise the same one they will come back to, which is
     the point. A separate one-off wizard teaches a place that then vanishes. */
  const isInitialSetup = searchParams.get("setup") === "true";
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "profile");

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [openTimezone, setOpenTimezone] = useState(false);
  const [openCountry, setOpenCountry] = useState(false);

  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    email: "",
    title: "",
    location: "",
    timezone: "",
    bio: "",
    avatar: "",
    // Opt in. Members are not contactable until they choose to be.
    allowMessaging: false,
    notifyCourseUpdates: true,
    notifyCommunityMentions: true,
    notifyMarketing: false,
  });

  // The stored profile is the authority, never this browser's copy.
  useEffect(() => {
    let cancelled = false;
    getProfile().then((p) => {
      if (cancelled) {
        return;
      }
      if (p) {
        setProfile((prev) => ({
          ...prev,
          firstName: p.first_name ?? "",
          lastName: p.last_name ?? "",
          email: p.email ?? "",
          title: p.title ?? "",
          location: p.location ?? "",
          timezone: p.timezone ?? "",
          bio: p.bio ?? "",
          avatar: p.avatar_url ?? "",
          allowMessaging: p.allow_messaging,
          notifyCourseUpdates: p.notify_course_updates,
          notifyCommunityMentions: p.notify_community_mentions,
          notifyMarketing: p.notify_marketing,
        }));
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const completionPercentage =
    [
      profile.firstName,
      profile.lastName,
      profile.email,
      profile.bio,
      profile.avatar,
    ].filter(Boolean).length * 20;

  useEffect(() => {
    if (isInitialSetup) {
      toast({
        title: "Welcome aboard",
        description: "Your account is secure. Now let's finish your profile.",
      });
    }
  }, [isInitialSetup]);

  const save = async (message: string) => {
    setIsSaving(true);
    const result = await updateProfile({
      firstName: profile.firstName,
      lastName: profile.lastName,
      title: profile.title,
      location: profile.location,
      timezone: profile.timezone,
      bio: profile.bio,
      avatarUrl: profile.avatar,
      allowMessaging: profile.allowMessaging,
      notifyCourseUpdates: profile.notifyCourseUpdates,
      notifyCommunityMentions: profile.notifyCommunityMentions,
      notifyMarketing: profile.notifyMarketing,
    });
    setIsSaving(false);

    if (!result.ok) {
      toast({
        variant: "destructive",
        title: "Could not save",
        description: result.error,
      });
      return;
    }

    // Tells the header to re-read the name and picture.
    window.dispatchEvent(new Event("profileUpdate"));

    /* Saved here either way, and said plainly rather than implying the
       change was lost when only the CRM mirror was late. */
    toast(
      result.crmSynced
        ? { title: message, description: "Your changes have been saved." }
        : {
            title: message,
            description:
              "Your changes are saved. Updating your contact record is taking a moment and will catch up shortly.",
          },
    );
  };

  const handleAvatar = (file: File) => {
    if (file.size > MAX_AVATAR_BYTES) {
      toast({
        variant: "destructive",
        title: "That picture is too large",
        description: "Please choose an image under 800K.",
      });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () =>
      setProfile((prev) => ({ ...prev, avatar: reader.result as string }));
    reader.readAsDataURL(file);
  };

  /* ---- Security ---------------------------------------------------- */
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmNew, setConfirmNew] = useState("");
  const [isChanging, setIsChanging] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
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
    if (next !== confirmNew) {
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

    setIsChanging(true);
    const result = await changePassword(current, next);
    setIsChanging(false);

    if (!result.ok) {
      toast({
        variant: "destructive",
        title: "Could not change your password",
        description: result.error,
      });
      return;
    }

    toast({
      title: "Password changed",
      description: "Please sign in again with your new password.",
    });

    // A password change on a borrowed machine should not leave the old
    // session usable.
    await signOut();
    navigate("/login");
  };

  const initials =
    `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}` || "U";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {isInitialSetup && (
          <div className="flex items-start gap-4 rounded-xl border border-primary/20 bg-primary/5 p-6">
            <div className="rounded-full bg-primary/10 p-3">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">
                Let's finish setting up your account
              </h2>
              <p className="text-sm text-muted-foreground">
                Complete your profile details to get the most out of the community.
              </p>
            </div>
          </div>
        )}

        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Settings
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage your account settings, profile preferences, and notifications.
          </p>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  Profile completion
                  {completionPercentage === 100 && (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  )}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Complete your profile to build trust in the community.
                </p>
              </div>
              <div className="text-2xl font-bold text-primary">
                {completionPercentage}%
              </div>
            </div>
            <Progress value={completionPercentage} className="h-3 bg-primary/10" />
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          {/* ---- Profile -------------------------------------------- */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile information</CardTitle>
                <CardDescription>
                  Update your personal details and public profile for the community.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <div className="flex items-center gap-6">
                      <Avatar className="h-24 w-24">
                        <AvatarImage src={profile.avatar || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-2">
                        <Label htmlFor="avatar-upload" className="cursor-pointer">
                          <div className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
                            Change picture
                          </div>
                          <input
                            id="avatar-upload"
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleAvatar(file);
                            }}
                          />
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          JPG, GIF or PNG. Max size of 800K.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First name</Label>
                        <Input
                          id="firstName"
                          value={profile.firstName}
                          onChange={(e) =>
                            setProfile({ ...profile, firstName: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last name</Label>
                        <Input
                          id="lastName"
                          value={profile.lastName}
                          onChange={(e) =>
                            setProfile({ ...profile, lastName: e.target.value })
                          }
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="email">Email address</Label>
                        <Input
                          id="email"
                          value={profile.email}
                          readOnly
                          disabled
                          className="bg-muted/60"
                        />
                        <p className="text-xs text-muted-foreground">
                          Your sign-in address. Get in touch if it needs changing.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="timezone">Timezone</Label>
                        <Popover open={openTimezone} onOpenChange={setOpenTimezone}>
                          <PopoverTrigger asChild>
                            <Button
                              id="timezone"
                              variant="outline"
                              role="combobox"
                              aria-expanded={openTimezone}
                              className="w-full justify-between font-normal"
                            >
                              {profile.timezone
                                ? profile.timezone.replace(/_/g, " ")
                                : "Select timezone..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                              <CommandInput placeholder="Search timezone..." />
                              <CommandList>
                                <CommandEmpty>No timezone found.</CommandEmpty>
                                <CommandGroup>
                                  {TIMEZONES.map((tz) => (
                                    <CommandItem
                                      key={tz}
                                      value={tz}
                                      onSelect={() => {
                                        setProfile({ ...profile, timezone: tz });
                                        setOpenTimezone(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          profile.timezone === tz
                                            ? "opacity-100"
                                            : "opacity-0",
                                        )}
                                      />
                                      {tz.replace(/_/g, " ")}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <Popover open={openCountry} onOpenChange={setOpenCountry}>
                          <PopoverTrigger asChild>
                            <Button
                              id="country"
                              variant="outline"
                              role="combobox"
                              aria-expanded={openCountry}
                              className="w-full justify-between font-normal"
                            >
                              {profile.location
                                ? (COUNTRIES.find(
                                    (c) => c.value === profile.location,
                                  )?.label ?? profile.location)
                                : "Select country..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                              <CommandInput placeholder="Search country..." />
                              <CommandList>
                                <CommandEmpty>No country found.</CommandEmpty>
                                <CommandGroup>
                                  {COUNTRIES.map((country) => (
                                    <CommandItem
                                      key={country.value}
                                      value={country.label}
                                      onSelect={() => {
                                        setProfile({
                                          ...profile,
                                          location: country.value,
                                        });
                                        setOpenCountry(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          profile.location === country.value
                                            ? "opacity-100"
                                            : "opacity-0",
                                        )}
                                      />
                                      {country.label}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="title">Professional title</Label>
                        <Input
                          id="title"
                          placeholder="Partner, Corporate Advisory"
                          value={profile.title}
                          onChange={(e) =>
                            setProfile({ ...profile, title: e.target.value })
                          }
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="bio">Professional bio</Label>
                        <Textarea
                          id="bio"
                          rows={5}
                          placeholder="A few lines about your work and what you are here to learn."
                          value={profile.bio}
                          onChange={(e) =>
                            setProfile({ ...profile, bio: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  onClick={() => save("Profile updated")}
                  disabled={isSaving || loading}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* ---- Security ------------------------------------------- */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Password</CardTitle>
                <CardDescription>
                  Change the password you use to sign in to {"the academy"}. You
                  will be signed out afterwards.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleChangePassword}>
                <CardContent className="max-w-md space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current">Current password</Label>
                    <Input
                      id="current"
                      type="password"
                      required
                      value={current}
                      onChange={(e) => setCurrent(e.target.value)}
                      disabled={isChanging}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="next">New password</Label>
                    <Input
                      id="next"
                      type="password"
                      required
                      value={next}
                      onChange={(e) => setNext(e.target.value)}
                      disabled={isChanging}
                    />
                  </div>
                  <PasswordRequirements
                    value={next}
                    className="rounded-lg bg-muted/60 p-4"
                  />
                  <div className="space-y-2">
                    <Label htmlFor="confirm-new">Confirm new password</Label>
                    <Input
                      id="confirm-new"
                      type="password"
                      required
                      value={confirmNew}
                      onChange={(e) => setConfirmNew(e.target.value)}
                      disabled={isChanging}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    type="submit"
                    disabled={isChanging || !current || !isPasswordValid(next)}
                  >
                    {isChanging ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Changing...
                      </>
                    ) : (
                      "Update password"
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          {/* ---- Notifications -------------------------------------- */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Community and privacy</CardTitle>
                <CardDescription>
                  Control your visibility and interactions within the community.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="allow-messaging">Allow direct messages</Label>
                    <p className="text-sm text-muted-foreground">
                      Let other members send you private messages. Off until you
                      turn it on.
                    </p>
                  </div>
                  <Switch
                    id="allow-messaging"
                    checked={profile.allowMessaging}
                    onCheckedChange={(v) =>
                      setProfile({ ...profile, allowMessaging: v })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Email notifications</CardTitle>
                <CardDescription>
                  Choose what updates you want to receive from {"the academy"}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="notify-courses">Course updates</Label>
                    <p className="text-sm text-muted-foreground">
                      New modules, resources and live coaching sessions.
                    </p>
                  </div>
                  <Switch
                    id="notify-courses"
                    checked={profile.notifyCourseUpdates}
                    onCheckedChange={(v) =>
                      setProfile({ ...profile, notifyCourseUpdates: v })
                    }
                  />
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="notify-community">Community mentions</Label>
                    <p className="text-sm text-muted-foreground">
                      When someone replies to you or mentions you.
                    </p>
                  </div>
                  <Switch
                    id="notify-community"
                    checked={profile.notifyCommunityMentions}
                    onCheckedChange={(v) =>
                      setProfile({ ...profile, notifyCommunityMentions: v })
                    }
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
                    checked={profile.notifyMarketing}
                    onCheckedChange={(v) =>
                      setProfile({ ...profile, notifyMarketing: v })
                    }
                  />
                </div>
              </CardContent>
              <CardFooter className="flex-col items-start gap-2">
                <Button
                  onClick={() => save("Preferences saved")}
                  disabled={isSaving || loading}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
                <p className="text-sm text-muted-foreground">
                  Saves every preference on this tab, including your direct
                  message setting.
                </p>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
