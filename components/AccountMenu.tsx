"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "@/hooks/useSession";

/**
 * Identity in the top bar.
 *
 * Signed out it is a single "Entrar" button; the app already works without an
 * account, so this never blocks anything — it only offers to keep your
 * collection and let other people see it.
 */
export default function AccountMenu() {
  const { available, loading, user, profile, signInWithGoogle, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!available || loading) return null;

  if (!user) {
    return (
      <button
        onClick={signInWithGoogle}
        className="flex items-center gap-2 border border-paper/25 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-paper/70 transition hover:border-paper/60 hover:text-paper"
      >
        <GoogleMark />
        Entrar
      </button>
    );
  }

  const initials = (profile?.displayName || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div ref={ref} className="relative">
      {/* It is a photograph, so nothing about it says "press me". A ring that
          tightens and a face that lifts is the smallest thing that reads as a
          control without turning the picture into a button. */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Tu cuenta"
        title={profile ? `${profile.displayName} · tu cuenta` : "Tu cuenta"}
        className="group relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-paper/25 mono text-[10px] text-paper/80 transition-all duration-fast hover:scale-105 hover:border-paper hover:shadow-[0_0_0_3px_rgba(245,243,238,0.10)]"
      >
        {profile?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt=""
            className="h-full w-full object-cover brightness-90 transition duration-fast group-hover:brightness-110"
          />
        ) : (
          initials
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[220px] border border-line-overlay bg-surface-overlay py-1 shadow-popover">
          <div className="border-b border-paper/10 px-3 pb-2 pt-1.5">
            <div className="truncate text-[13px] text-paper">{profile?.displayName}</div>
            <div className="mono truncate text-[11px] text-paper/40">@{profile?.username}</div>
          </div>
          <MenuLink href={`/u/${profile?.username ?? ""}`}>Mi perfil</MenuLink>
          <MenuLink href="/feed">Novedades</MenuLink>
          <MenuLink href="/explorar">Explorar</MenuLink>
          <MenuLink href="/ajustes">Ajustes</MenuLink>
          <button
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="w-full px-3 py-2 text-left text-[13px] text-paper/60 transition hover:bg-paper/[0.06] hover:text-paper"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 text-[13px] text-paper/80 transition hover:bg-paper/[0.06] hover:text-paper"
    >
      {children}
    </Link>
  );
}

function GoogleMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z" />
      <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3z" />
      <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
    </svg>
  );
}
