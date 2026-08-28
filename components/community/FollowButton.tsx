"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Confirm from "@/components/ui/Confirm";
import { useToast, ToastIcon } from "@/components/ui/Toast";
import { useDevice } from "@/hooks/useDevice";
import { useRelationship } from "@/hooks/useRelationship";

/**
 * Seguir / Siguiendo, and the small decisions inside it.
 *
 * **Unfollowing asks first, but only on touch.** On a desktop, hovering
 * "Siguiendo" turns it into "Dejar de seguir" and a click is deliberate — the
 * pointer proved intent by arriving. A finger proves nothing: it lands where it
 * lands, and an accidental unfollow is silent and unrecoverable, since nothing
 * tells you it happened. Instagram confirms this on mobile for exactly this
 * reason, and skips it on the web for exactly the other one.
 *
 * **The label never becomes "Dejar de seguir" on touch**, because there is no
 * hover to explain why it changed. It stays "Siguiendo" and the sheet asks.
 *
 * **The width is locked.** "Seguir" and "Siguiendo" are different lengths, and
 * a button that resizes on press shoves the layout around the thing you just
 * touched.
 */
export default function FollowButton({
  profileId,
  displayName,
  size = "md",
  block = false,
}: {
  profileId: string;
  displayName: string;
  size?: "sm" | "md";
  block?: boolean;
}) {
  const { rel, loading, toggle } = useRelationship(profileId);
  const { hover } = useDevice();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [hovering, setHovering] = useState(false);

  // Yourself, or an answer that hasn't arrived: render nothing rather than a
  // button that might be about to mean the opposite of what it says.
  if (loading || rel?.isYou) {
    return <span aria-hidden style={{ minWidth: block ? undefined : 104 }} />;
  }

  const following = rel?.following ?? false;

  const run = async () => {
    try {
      await toggle();
      if (!following) toast.show(`Sigues a ${displayName}`, { media: { icon: ToastIcon.person } });
    } catch {
      toast.show("No se pudo guardar. Inténtalo otra vez.", { tone: "error" });
    }
  };

  const onPress = () => {
    if (following) {
      if (hover) void run();
      else setConfirming(true);
      return;
    }
    void run();
  };

  const label = following ? (hover && hovering ? "Dejar de seguir" : "Siguiendo") : "Seguir";

  return (
    <>
      <Button
        variant={following ? "secondary" : "primary"}
        size={size}
        block={block}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onClick={onPress}
        aria-label={following ? `Dejar de seguir a ${displayName}` : `Seguir a ${displayName}`}
        style={block ? undefined : { minWidth: size === "sm" ? 96 : 118 }}
      >
        {label}
      </Button>

      <Confirm
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`¿Dejar de seguir a ${displayName}?`}
        body="Sus novedades dejarán de aparecer en tu feed. Puedes volver a seguirle cuando quieras."
        confirmLabel="Dejar de seguir"
        onConfirm={() => void run()}
      />
    </>
  );
}

/** "te sigue" — the badge that turns a stranger into a decision. */
export function FollowsYouBadge({ profileId }: { profileId: string }) {
  const { rel } = useRelationship(profileId);
  if (!rel?.followsYou) return null;
  return (
    <span className="rounded-sm bg-fill px-1.5 py-0.5 text-micro font-medium uppercase tracking-label text-content-muted">
      Te sigue
    </span>
  );
}
