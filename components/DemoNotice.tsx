"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/hooks/useSession";

const DISMISSED = "vinilos.demo-notice.dismissed";

/**
 * You are looking at a shelf that lives in this browser only.
 *
 * Said once, quietly, and dismissable: nagging someone who is trying out a
 * product is the fastest way to make them leave.
 */
export default function DemoNotice() {
  const { available, user, signInWithGoogle } = useSession();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    setHidden(Boolean(localStorage.getItem(DISMISSED)));
  }, []);

  if (!available || user || hidden) return null;

  return (
    <div className="pointer-events-auto absolute left-1/2 top-[86px] z-30 flex -translate-x-1/2 items-center gap-4 border border-paper/12 bg-ink/85 px-4 py-2.5 backdrop-blur-sm">
      <span className="text-[12px] text-paper/60">
        Esto vive solo en este navegador.
      </span>
      <button
        onClick={signInWithGoogle}
        className="mono text-[10px] uppercase tracking-[0.18em] text-paper underline-offset-4 transition hover:underline"
      >
        Guardar en mi cuenta
      </button>
      <button
        onClick={() => {
          localStorage.setItem(DISMISSED, "1");
          setHidden(true);
        }}
        aria-label="Descartar"
        className="text-paper/30 transition hover:text-paper"
      >
        <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
          <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
