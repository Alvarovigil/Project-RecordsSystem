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
   * spend its width on the name.
   *
   * Una silueta con un signo, y no un signo suelto. Un «+» y una palomita son
   * los iconos de añadir y de hecho: valen para cualquier cosa, y sobre una
   * tarjeta cuyo tema es una persona lo que leen es «marcado». Con la silueta
   * detrás, el mismo par de signos dice de qué va — se sigue a alguien, y se
   * le sigue ya. La palabra sigue estando para quien lee con la voz, y sigue
   * siendo la etiqueta allí donde el botón es el asunto de la pantalla.
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
              // la misma forma que el estado de hover dice con palabras en otros sitios: irse
              <PersonGlyph>
                <path d="M10.4 10.4 L13.6 13.6 M13.6 10.4 L10.4 13.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </PersonGlyph>
            ) : (
              <PersonGlyph>
                <path d="M10.1 12.1 L11.4 13.4 L14 10.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </PersonGlyph>
            )
          ) : (
            <PersonGlyph>
              <path d="M12 10.1 V13.9 M10.1 12 H13.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </PersonGlyph>
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

/**
 * Una persona, y a su lado lo que le pasa: un signo más, una palomita, un aspa.
 *
 * La silueta es la misma en los tres estados y solo cambia el signo, que es lo
 * que hace que el botón se lea de un vistazo sin haber visto el anterior: la
 * figura dice de qué trata y el signo dice en qué punto está. El hombro se
 * recorta por la derecha para que el signo tenga sitio propio y no se apoye
 * encima de la cabeza.
 */
function PersonGlyph({ children }: { children: React.ReactNode }) {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="6.6" cy="5.4" r="2.6" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M1.9 13.4c0-2.6 2.1-4.2 4.7-4.2 1 0 1.9.2 2.7.7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {children}
    </svg>
  );
}
