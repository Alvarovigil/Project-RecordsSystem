import type React from "react";
import { Page, Section } from "@/components/app/AppShell";
import { SkeletonFindRail, SkeletonRackRail } from "@/components/ui/Skeleton";
import { SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";
import { authTokenName, storedSessionIn } from "@/lib/auth-cookie";
import { FAKE_SESSION } from "@/lib/dev-session";

/**
 * El armazón de Explorar: lo que no depende de nada que solo sepa el cliente.
 *
 * Explorar lee `?q=` de la dirección, y una página estática que lo lee se
 * pinta en el cliente desde su `Suspense` para arriba. El HTML del servidor
 * traía ese hueco vacío: en un móvil lento eran tres segundos de negro con
 * la barra de pestañas debajo, hasta que llegaba el código (F8).
 *
 * Así que el buscador, los títulos y los esqueletos de las dos primeras
 * secciones son piezas de aquí, que pinta el servidor como `fallback` y que
 * `ExploreView` vuelve a usar tal cual: mismas clases, mismas medidas, y el
 * relevo no mueve nada.
 */

/** «Lo tienen ellos»: lo que dice, con sesión y sin ella */
export const OTHERS = {
  member: {
    title: "Lo tienen ellos, tú no",
    note: "Discos sacados de los racks de aquí abajo. Ábrelos y verás quién más los tiene.",
  },
  // sin sesión el título ya dice de dónde salen: la nota no lo repite
  visitor: { title: "De los racks de aquí abajo", note: "Ábrelos y verás quién más los tiene." },
} as const;

export const RACKS = {
  title: "Racks que vale la pena abrir",
  note: "Montados con criterio, no carpetas.",
} as const;

export const RECENTS_KEY = "vinilos.recent-searches.v1";

/**
 * La barra del buscador.
 *
 * The bar itself carries no background on a phone: the pill is the thing that
 * floats, and it can only look like it floats if what is behind it goes past
 * it. A scrim across the full width would have made the blur decorative.
 */
export function SearchBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-20 -mx-5 bg-surface/95 px-5 pb-3 pt-1 backdrop-blur-md sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:pb-7 sm:pt-0 sm:backdrop-blur-none">
      <div className="mx-auto w-full max-w-[560px]">{children}</div>
    </div>
  );
}

/**
 * Un campo, del ancho de la página.
 *
 * Era una píldora que crecía: en reposo medía nueve caracteres y se quedaba
 * flotando en mitad del ancho, gorda y centrada. Ahora es lo que es: un campo,
 * alineado con todo lo demás, del ancho del contenido y de la altura de un
 * control. Sin sombra ni aro y sin animación, porque no cambia de tamaño.
 *
 * `after` es lo que va dentro, a la derecha (el aspa de borrar).
 */
export function SearchField({
  after,
  ...input
}: React.ComponentPropsWithRef<"input"> & { after?: React.ReactNode }) {
  return (
    <div className="relative flex h-11 w-full items-center gap-2.5 rounded-full bg-fill-subtle px-4 transition-colors focus-within:bg-fill sm:h-auto sm:gap-0 sm:rounded-none sm:border-b sm:border-line sm:bg-transparent sm:px-0 sm:focus-within:bg-transparent sm:focus-within:border-line-strong">
      {/* the magnifier lives on the phone only: collapsed to a pill the field
          has no shape of its own to explain what it is — the wide version,
          where the placeholder is a full sentence, does without it */}
      <svg
        width="15"
        height="15"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden
        className="shrink-0 text-content-muted sm:hidden"
      >
        <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10.4 10.4 L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <input
        {...input}
        enterKeyHint="search"
        type="search"
        autoCapitalize="none"
        autoCorrect="off"
        aria-label="Buscar discos, racks o personas"
        placeholder="Buscar"
        /* The query, set as type rather than typed into a widget: large,
           centred on the wide screen, on a rule that lights up when the
           cursor is in it. */
        className="peer min-w-0 flex-1 self-stretch bg-transparent text-left sm:self-auto text-sub text-paper outline-none placeholder:text-content-faint sm:w-full sm:pb-3 sm:pt-1 sm:text-center sm:text-title sm:placeholder:text-transparent"
      />

      {/* The wide field asks the longer question, drawn rather than set as the
          placeholder because the two breakpoints want different words and
          only one `placeholder` exists. CSS decides, so it is right on frame
          one. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1 hidden text-center text-title text-content-faint sm:peer-placeholder-shown:block"
      >
        Busca discos, listas o personas
      </span>
      {after}
    </div>
  );
}

/** Una búsqueda reciente: tocarla la repite, el aspa la olvida. */
export function RecentChip({
  text,
  onPick,
  onForget,
}: {
  text: string;
  onPick?: () => void;
  onForget?: () => void;
}) {
  return (
    <li className="flex items-center rounded-full bg-fill">
      <button
        onClick={onPick}
        className="pressable py-2 pl-3.5 pr-1.5 text-sub text-content-secondary hover:text-paper"
      >
        {text}
      </button>
      <button
        onClick={onForget}
        aria-label={`Quitar ${text} del historial`}
        className="pressable flex h-8 w-7 items-center justify-center text-content-faint hover:text-paper"
      >
        <svg width="9" height="9" viewBox="0 0 14 14" fill="none">
          <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  );
}

/**
 * Lo que el servidor pinta de Explorar mientras llega el código.
 *
 * Tres cosas solo las sabe el navegador: si hay sesión (cambia el título de
 * la primera sección, y su nota pasa de dos líneas a una), las búsquedas
 * recientes (van encima de todo) y el `?q=` (una página estática no lo ve).
 * Las pone un guion de unas líneas antes del primer pintado, con lo mismo que
 * leerá `ExploreView` después; si no, el relevo movería la pantalla. El
 * resultado queda escrito en el propio armazón (`data-visitor`), y
 * `ExploreView` lo lee de ahí para empezar diciendo lo mismo.
 *
 * El guion va justo antes de las secciones: todo lo que toca está por encima
 * de él, y lo que depende de él todavía no se ha leído cuando corre.
 */
export function ExploreShell() {
  // la misma comprobación que lib/data, convertida en texto: lib/auth-cookie
  const name = isSupabaseConfigured ? authTokenName(SUPABASE_URL) : null;
  const canBeVisitor = Boolean(name) && !FAKE_SESSION;
  const script = `(function(){var r=document.currentScript&&document.currentScript.parentElement;if(!r)return;try{var q=new URLSearchParams(location.search).get("q");if(q&&q.trim()){r.setAttribute("data-q","");var i=r.querySelector("input");if(i)i.value=q;}if(${canBeVisitor}){var n=${JSON.stringify(name ?? "")};if(!(${storedSessionIn.toString()})(n,document.cookie,localStorage.getItem(n)))r.setAttribute("data-visitor","");}var s=q&&q.trim()?[]:JSON.parse(localStorage.getItem(${JSON.stringify(RECENTS_KEY)})||"[]");if(Array.isArray(s)&&s.length){var t=r.querySelector("template"),u=r.querySelector("[data-recents-list]");s.slice(0,8).forEach(function(w){var li=t.content.firstElementChild.cloneNode(true);li.firstElementChild.textContent=w;u.appendChild(li);});r.setAttribute("data-recents","");}}catch(e){}})();`;

  return (
    <Page width="full">
      <div data-explore-shell className="group">
        <h1 className="sr-only">Explorar</h1>
        <SearchBar>
          <SearchField />
        </SearchBar>

        <div className="hidden group-data-[recents]:mt-9 group-data-[recents]:block">
          <Section title="Búsquedas recientes">
            <ul data-recents-list className="flex flex-wrap gap-2" />
          </Section>
          <template>
            <RecentChip text="" />
          </template>
        </div>

        {/* Aquí, antes de las secciones: lo que decide se aplica antes de
            que el navegador pueda pintarlas, nunca después (con la CPU lenta
            pintaba la versión con sesión y un fotograma después saltaba). */}
        <script dangerouslySetInnerHTML={{ __html: script }} />

        <div className="group-data-[q]:hidden">
          {/* el envoltorio de `Hold`, con su margen (aquí nunca es el primero) */}
          <div className="mt-9">
            {/* cada versión en su caja, para que la sección siga siendo la
                primera de la suya y no lleve margen, como dentro de `Hold` */}
            <div className="group-data-[visitor]:hidden">
              <Section title={OTHERS.member.title} note={OTHERS.member.note}>
                <SkeletonFindRail />
              </Section>
            </div>
            <div className="hidden group-data-[visitor]:block">
              <Section title={OTHERS.visitor.title} note={OTHERS.visitor.note}>
                <SkeletonFindRail />
              </Section>
            </div>
          </div>
          <Section id="racks" title={RACKS.title} note={RACKS.note}>
            <SkeletonRackRail n={5} />
          </Section>
        </div>
      </div>
    </Page>
  );
}
