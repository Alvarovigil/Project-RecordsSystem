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
  icon = false,
}: {
  profileId: string;
  displayName: string;
  size?: "sm" | "md";
  block?: boolean;
  /**
   * A circle with a mark in it instead of a word.
   *
   * For rows: a list of people is a column of names, and a column of buttons
   * beside it makes the buttons the loudest thing on a screen whose subject is
   * the people. As an icon the control gets out of the way and the row can
   * spend its width on the name — but it only works where the two states are
   * unmistakable, which is why the followed one is a tick and not a second
   * person-shape. The word is still there for a screen reader, and it is still
   * the label everywhere the button is the point of the screen.
   */
  icon?: boolean;
}) {
  const { rel, loading, toggle } = useRelationship(profileId);
  const { hover } = useDevice();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [hovering, setHovering] = useState(false);

  // Yourself, or an answer that hasn't arrived: render nothing rather than a
  // button that might be about to mean the opposite of what it says.
  if (loading || rel?.isYou) {
    return <span aria-hidden style={{ minWidth: block ? undefined : icon ? 36 : 104 }} />;
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

  if (icon) {
    return (
      <>
        <button
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          onClick={onPress}
          aria-label={following ? `Dejar de seguir a ${displayName}` : `Seguir a ${displayName}`}
          title={label}
          className={`pressable flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
            following
              ? "border-line-strong text-content-secondary hover:border-[#ff6b57]/40 hover:text-[#ff6b57]"
              : "border-transparent bg-paper text-ink hover:bg-paper/90"
          }`}
        >
          {following ? (
            hover && hovering ? (
              // the same shape the hover state says in words elsewhere: leaving
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M2.5 7.4 L5.4 10.2 L11.5 3.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )
          ) : (
            <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M7 2.6 V11.4 M2.6 7 H11.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          )}
        </button>

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
    /**
     * On the handle line, and never allowed to wrap.
     *
     * Two words in a box that breaks into two lines reads as damage. It cannot
     * shrink the handle either — `shrink-0` means the handle truncates and the
     * badge stays whole, because half a username is still a username and half
     * a badge is a bug.
     */
    <span className="shrink-0 whitespace-nowrap rounded-sm bg-fill px-1.5 py-0.5 text-micro font-medium uppercase tracking-label text-content-muted">
      Te sigue
    </span>
  );
}
