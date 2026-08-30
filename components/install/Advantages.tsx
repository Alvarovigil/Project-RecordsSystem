"use client";

/**
 * Why it is worth two taps — shown, not listed.
 *
 * These were three lines of prose behind a hairline rule: true, readable, and
 * completely skippable, because a list of sentences on a page whose subject is
 * a *phone* has nothing to look at. Each one is now a card with the thing it
 * claims drawn inside it, at the size the claim is about.
 *
 * The middle one earns its place on its own: "sin barra de navegador" is an
 * abstraction until you see the same shelf with the bar and without it, and
 * then it is a row of sleeves you were being charged for. A comparison is the
 * only honest way to draw an absence.
 *
 * Cards rather than a run of paragraphs, and the same card as the steps above
 * — one radius, one fill. Three claims in three identical boxes read as a
 * specification; three paragraphs read as an argument, and an argument invites
 * disagreement where a specification does not.
 */
export default function Advantages() {
  return (
    <ul className="space-y-2.5">
      <Card
        title="La cámara, a un toque"
        body="En una tienda, con la funda en la mano: del icono al código de barras. Desde una pestaña son buscar el navegador, buscar la pestaña y esperar."
        visual={<TapToCamera />}
      />
      <Card
        title="Sin barra de navegador"
        body="La pantalla entera es estantería: una fila más de fundas y portadas que llegan hasta el borde."
        visual={<BarComparison />}
      />
      <Card
        title="Se abre donde lo dejaste"
        body="Con la sesión puesta y en el rack que estabas mirando. Nada que volver a encontrar."
        visual={<ResumesWhereYouWere />}
      />
    </ul>
  );
}

function Card({
  title,
  body,
  visual,
}: {
  title: string;
  body: string;
  visual: React.ReactNode;
}) {
  return (
    <li className="overflow-hidden rounded-[14px] bg-fill-subtle">
      <div aria-hidden className="flex h-[104px] items-center justify-center bg-ink/40 px-5">
        {visual}
      </div>
      <div className="px-4 py-4">
        <p className="text-body font-medium text-paper">{title}</p>
        <p className="mt-1 text-sub leading-relaxed text-content-muted">{body}</p>
      </div>
    </li>
  );
}

/** the icon, an arrow, and what is on the other side of it */
function TapToCamera() {
  return (
    <div className="flex items-center gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-512.png" alt="" className="h-12 w-12 rounded-[11px]" />
      <svg width="26" height="10" viewBox="0 0 26 10" fill="none" className="text-content-faint">
        <path d="M0 5h24M20 1l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="relative flex h-12 w-[86px] items-center justify-center rounded-[6px] bg-black">
        {[
          "left-1 top-1 border-l border-t",
          "right-1 top-1 border-r border-t",
          "left-1 bottom-1 border-b border-l",
          "right-1 bottom-1 border-b border-r",
        ].map((pos) => (
          <span key={pos} className={`absolute h-2.5 w-2.5 border-paper/80 ${pos}`} />
        ))}
        {/* a barcode, at the only size it needs to be recognised */}
        <span className="flex h-5 items-end gap-[2px]">
          {[6, 3, 3, 8, 3, 6, 3, 3, 8, 4, 3, 6].map((w, n) => (
            <span
              key={n}
              className="block h-full bg-paper/85"
              style={{ width: w / 2 }}
            />
          ))}
        </span>
      </span>
    </div>
  );
}

/** the same shelf, with the bar and without it */
function BarComparison() {
  return (
    <div className="flex items-end gap-5">
      <MiniPhone withBar />
      <MiniPhone />
    </div>
  );
}

function MiniPhone({ withBar = false }: { withBar?: boolean }) {
  return (
    <span className="flex flex-col items-center gap-2">
      <span className="relative block h-[62px] w-[42px] overflow-hidden rounded-[7px] border border-paper/15 bg-surface">
        {withBar && (
          <span className="flex h-[13px] items-center gap-[3px] border-b border-paper/10 bg-ink px-1">
            <span className="h-[3px] w-[3px] rounded-full bg-paper/25" />
            <span className="h-[5px] flex-1 rounded-full bg-paper/[0.12]" />
          </span>
        )}
        <span className="grid grid-cols-2 gap-[3px] p-[4px]">
          {Array.from({ length: withBar ? 4 : 6 }).map((_, n) => (
            <span key={n} className="aspect-square rounded-[1px] bg-paper/25" />
          ))}
        </span>
      </span>
      <span className="text-[10px] leading-none text-content-faint">
        {withBar ? "Navegador" : "Instalada"}
      </span>
    </span>
  );
}

/** it opens on the rack you were in, not on a home page */
function ResumesWhereYouWere() {
  return (
    <span className="flex w-full max-w-[240px] items-center gap-3 rounded-[10px] bg-ink px-3 py-2.5">
      <span className="flex h-8 items-center gap-1.5 rounded-full bg-paper/[0.09] px-3 text-[11px] text-paper">
        Jazz de domingo
        <span className="text-paper/35">18</span>
      </span>
      <span className="flex flex-1 gap-1.5">
        {[0, 1, 2].map((n) => (
          <span key={n} className="h-8 w-8 rounded-[2px] bg-paper/20" />
        ))}
      </span>
    </span>
  );
}
