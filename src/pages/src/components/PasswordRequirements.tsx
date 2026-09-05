import { Check, X } from "lucide-react";

/**
 * The password rules, in one place.
 *
 * These mirror what Supabase enforces on this project. They live here rather
 * than being retyped on each screen so that what a member is shown and what
 * is actually checked can never drift apart, and so that if the rules change
 * in the Supabase dashboard there is exactly one file to change here.
 *
 * Previously the only guidance was a placeholder reading "At least 8
 * characters", which was true but incomplete: a member would choose eight
 * lowercase letters, submit, and only then be told about capitals and
 * symbols by an error message. Rules you can only discover by failing are
 * not rules, they are a guessing game.
 */

/** The symbol set Supabase accepts. Kept as a string so it needs no escaping. */
const SYMBOLS = "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~";

export const MIN_PASSWORD_LENGTH = 8;

export interface PasswordCheck {
  label: string;
  met: boolean;
}

/** Every rule, and whether this password satisfies it. */
export const checkPassword = (password: string): PasswordCheck[] => [
  {
    label: `At least ${MIN_PASSWORD_LENGTH} characters`,
    met: password.length >= MIN_PASSWORD_LENGTH,
  },
  { label: "One lowercase letter (a-z)", met: /[a-z]/.test(password) },
  { label: "One capital letter (A-Z)", met: /[A-Z]/.test(password) },
  { label: "One number (0-9)", met: /[0-9]/.test(password) },
  {
    label: "One symbol (! ? @ # $ % & * and similar)",
    met: [...password].some((c) => SYMBOLS.includes(c)),
  },
];

export const isPasswordValid = (password: string): boolean =>
  checkPassword(password).every((r) => r.met);

/**
 * The first rule this password fails, phrased for a message box.
 *
 * Used where a toast is the right place to say it, so the wording matches
 * the list rather than being written twice.
 */
export const firstPasswordProblem = (password: string): string | null =>
  checkPassword(password).find((r) => !r.met)?.label ?? null;

interface Props {
  value: string;
  className?: string;
}

/**
 * The rules, ticking off as they are met.
 *
 * Shown from the start rather than after a failure, so nobody has to submit
 * to find out what is expected. Grey when unmet rather than red, because
 * a half typed password is not a mistake.
 */
export const PasswordRequirements = ({ value, className }: Props) => {
  const rules = checkPassword(value);

  return (
    <div className={className}>
      <p className="text-sm font-medium text-foreground mb-2">
        Your password needs
      </p>
      <ul className="space-y-1.5">
        {rules.map((rule) => (
          <li
            key={rule.label}
            className={`flex items-center gap-2 text-sm transition-colors ${
              rule.met ? "text-green-600" : "text-muted-foreground"
            }`}
          >
            {rule.met ? (
              <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <X className="h-4 w-4 shrink-0 opacity-40" aria-hidden="true" />
            )}
            <span>{rule.label}</span>
            <span className="sr-only">{rule.met ? "met" : "not yet met"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PasswordRequirements;
