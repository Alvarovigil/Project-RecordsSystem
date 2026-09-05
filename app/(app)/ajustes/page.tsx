"use client";

import { useState } from "react";
import Link from "next/link";
import { Page } from "@/components/app/AppShell";
import Avatar from "@/components/ui/Avatar";
import EditProfileSheet from "@/components/community/EditProfileSheet";
import Confirm from "@/components/ui/Confirm";
import { useSession } from "@/hooks/useSession";
import { useInstall } from "@/hooks/useInstall";
import type { Profile } from "@/lib/data/types";

/**
 * Ajustes: la cuenta, no la persona.
 *
 * Esta pantalla y «Editar perfil» pedían lo mismo — nombre, usuario y bio — en
 * dos sitios distintos: una hoja en el perfil y un formulario aquí. Dos
 * formularios para un dato son dos sitios donde arreglarlo y uno donde
 * olvidarse de hacerlo, y ya habían empezado a separarse (aquí no se podía
 * cambiar la foto).
 *
 * Así que el perfil se edita en un solo sitio, y desde aquí se llega a él. Lo
 * que queda es lo que de verdad es de la cuenta y no de la persona: con qué
 * has entrado, en qué dispositivo estás, y la puerta de salida.
 */
export default function SettingsPage() {
  const { available, loading, user, profile, signInWithGoogle, signOut } = useSession();
  const { standalone } = useInstall();
  const [editing, setEditing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [me, setMe] = useState<Profile | null>(null);

  const shown = me ?? profile;

  return (
    <Page width={560}>
      <h1 className="text-display font-medium text-paper">Ajustes</h1>

      {!available ? (
        <p className="mt-8 text-sub text-content-muted">
          Sin base de datos configurada, tu colección vive solo en este navegador.
        </p>
      ) : loading ? null : !user ? (
        <div className="mt-8">
          <p className="text-body text-content-secondary">
            Entra para guardar tu colección y que otros puedan verla.
          </p>
          <button
            onClick={signInWithGoogle}
            className="pressable mt-5 flex h-12 items-center justify-center rounded-full bg-paper px-6 text-sub font-medium text-ink"
          >
            Entrar con Google
          </button>
        </div>
      ) : (
        <>
          {/**
           * Tú, tal y como se te ve.
           *
           * Una tarjeta con la cara, el nombre y el usuario antes que ninguna
           * opción: lo que se ajusta aquí es una cuenta que pertenece a
           * alguien, y enseñar a ese alguien es lo que evita la duda de «¿de
           * qué cuenta son estos ajustes?» cuando se tienen dos.
           */}
          {shown && (
            <div className="mt-7 flex items-center gap-4 rounded-[14px] bg-fill-subtle p-4">
              <Avatar
                name={shown.displayName}
                handle={shown.username}
                src={shown.avatarUrl}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-medium text-paper">{shown.displayName}</p>
                <p className="mono truncate text-sub text-content-muted">@{shown.username}</p>
              </div>
              <button
                onClick={() => setEditing(true)}
                className="pressable shrink-0 rounded-full bg-fill px-4 py-2 text-sub text-paper transition-colors hover:bg-fill-strong"
              >
                Editar
              </button>
            </div>
          )}

          <Group title="Tu perfil">
            <Row href={`/u/${shown?.username ?? ""}`} label="Ver mi perfil" note="Como lo ve todo el mundo" />
            <Row onClick={() => setEditing(true)} label="Nombre, usuario y foto" note="Y tu bio" />
          </Group>

          <Group title="La aplicación">
            <Row
              label="Cómo se está usando"
              note={standalone ? "Instalada en este dispositivo" : "En el navegador"}
              muted
            />
            {!standalone && (
              <Row href="/instalar" label="Instalar la app" note="Pantalla completa y arranque directo" />
            )}
            <Row href="/#sobre" label="Sobre el proyecto" note="Por qué existe Rackr" />
          </Group>

          <Group title="Cuenta">
            <Row label="Correo" note={user.email ?? "—"} muted />
            <Row onClick={() => setLeaving(true)} label="Cerrar sesión" danger />
          </Group>

          {shown && (
            <EditProfileSheet
              open={editing}
              onClose={() => setEditing(false)}
              profile={shown}
              onSaved={setMe}
            />
          )}

          {/* Cerrar sesión en un teléfono es un botón al que se llega sin
              querer, y volver a entrar cuesta un viaje al selector de cuentas
              de Google. Una pregunta corta es más barata que ese viaje. */}
          <Confirm
            open={leaving}
            onClose={() => setLeaving(false)}
            title="¿Cerrar sesión?"
            body="Tu colección se queda guardada. Para volver a verla tendrás que entrar otra vez con Google."
            confirmLabel="Cerrar sesión"
            onConfirm={() => void signOut()}
          />
        </>
      )}
    </Page>
  );
}

/** un bloque de ajustes: título pequeño y una tarjeta con sus filas dentro */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="text-caption uppercase tracking-label text-content-muted">{title}</h2>
      <ul className="mt-3 overflow-hidden rounded-[14px] bg-fill-subtle">{children}</ul>
    </section>
  );
}

/**
 * Una fila de ajustes.
 *
 * Tres formas y una sola maquetación: un enlace, un botón y un dato que solo
 * se lee. Se distinguen por si tienen flecha, no por cómo están escritas —
 * cuando cada fila se maqueta por su cuenta acaban con tres alturas distintas
 * en la misma tarjeta.
 */
function Row({
  label,
  note,
  href,
  onClick,
  danger = false,
  muted = false,
}: {
  label: string;
  note?: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
  muted?: boolean;
}) {
  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-body ${danger ? "text-[#ff6b57]" : "text-content"}`}>
          {label}
        </span>
        {note && <span className="block truncate text-caption text-content-muted">{note}</span>}
      </span>
      {!muted && (
        <span aria-hidden className="shrink-0 text-content-faint">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M5 2.5 L9.5 7 L5 11.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
    </>
  );

  const cls =
    "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors border-b border-line last:border-b-0";

  return (
    <li className="last:border-b-0">
      {href ? (
        <Link href={href} className={`pressable hover:bg-fill ${cls}`}>
          {inner}
        </Link>
      ) : onClick ? (
        <button onClick={onClick} className={`pressable hover:bg-fill ${cls}`}>
          {inner}
        </button>
      ) : (
        <div className={cls}>{inner}</div>
      )}
    </li>
  );
}
