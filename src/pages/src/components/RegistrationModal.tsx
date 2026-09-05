import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BRAND } from "@/config/brand";

/**
 * Registration, which does not happen here.
 *
 * The form below is the same GoHighLevel form that sits on the website's
 * /community page. It creates the CRM contact and the workflow applies the
 * PSLA Community tag. The academy never creates a contact and never grants
 * anything: it only verifies, later, that a contact exists.
 *
 * Embedding it rather than linking out means somebody who reaches the sign-in
 * page without an account is not sent away to a different site and expected
 * to find their way back.
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const RegistrationModal = ({ isOpen, onClose }: Props) => {
  useEffect(() => {
    if (!isOpen) return;

    const existing = document.querySelector(
      `script[src="${BRAND.links.registrationFormLoader}"]`,
    );
    if (existing) return;

    const script = document.createElement("script");
    script.src = BRAND.links.registrationFormLoader;
    script.async = true;
    document.body.appendChild(script);
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Join the PSLA Community</DialogTitle>
          <DialogDescription>
            Free. Enter your work details so we know you are in professional
            services. You will set a password straight afterwards.
          </DialogDescription>
        </DialogHeader>

        <iframe
          src={BRAND.links.registrationForm}
          title="Join the PSLA Community"
          className="h-[560px] w-full rounded-md border-0"
        />
      </DialogContent>
    </Dialog>
  );
};

export default RegistrationModal;
