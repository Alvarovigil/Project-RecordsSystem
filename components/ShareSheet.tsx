"use client";

import { useEffect, useRef, useState } from "react";
import Sheet from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";

/**
 * Handing something to someone else.
 *
 * The thing being handed over is a picture, not a link. A link to a collection
 * app asks the person on the other end to leave the app they are in, load a
 * page and meet a login; a 9:16 card is native to where sharing actually
 * happens, works inside Instagram or WhatsApp without going anywhere, and
 * carries the address at the bottom for anybody who does want the page.
 *
 * Built for a phone, because that is where this is used — a story is composed
 * on a phone, always. On a desktop the same sheet appears with the copy and
 * download rows doing the work, since there is no share target to hand a file
 * to.
 *
 * The image is generated on the server the moment this opens, which takes
 * about a second. That wait is why the preview exists: it shows what is about
 * to be shared, so the second is spent looking at something rather than at a
 * spinner over a button that has not done anything yet.
 */
export default function ShareSheet({
  open,
  onClose,
  image,
  link,
  title,
  filename,
}: {
  open: boolean;
  onClose: () => void;
  /** the 9:16 card, generated on demand */
  image: string;
  /** where the card points, for the copy row */
  link: string;
  /** what is being shared, said in the share dialog */
  title: string;
  filename: string;
}) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const asked = useRef<string | null>(null);

  /**
   * Fetch the card as a file, not just as an `<img src>`.
   *
   * The preview and the share need the same bytes, and asking the server twice
   * would render the image twice. Holding the blob also means the share
   * happens instantly when pressed — inside the user gesture, which is the
   * only place iOS will open a share sheet at all.
   */
  useEffect(() => {
    if (!open || asked.current === image) return;
    asked.current = image;
    setFailed(false);
    let alive = true;
    fetch(image)
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const blob = await r.blob();
        if (!alive) return;
        setFile(new File([blob], filename, { type: "image/png" }));
      })
      .catch(() => {
        if (!alive) return;
        asked.current = null;
        setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [open, image, filename]);

  const previewUrl = useObjectUrl(file);

  const share = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const data: ShareData = { files: [file], title, text: `${title} · ${link}` };
      if (navigator.canShare?.(data)) {
        await navigator.share(data);
      } else if (navigator.share) {
        // no file target — the link is still worth handing over
        await navigator.share({ title, text: title, url: link });
      } else {
        download();
      }
    } catch {
      // a cancelled share throws, and it is not an error worth saying anything about
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = filename;
    a.click();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.show("Enlace copiado");
    } catch {
      toast.show("No hemos podido copiar el enlace");
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Compartir" size="tall">
      <div className="scroll-y min-h-0 flex-1 overflow-y-auto px-5 pb-8">
        {/**
         * The card itself, at the shape it will be shared in.
         *
         * Showing a 9:16 preview rather than a square thumbnail is the whole
         * reassurance: people want to know what is about to appear on their
         * story before it appears on their story.
         */}
        <div className="mx-auto mt-2 w-full max-w-[260px] overflow-hidden rounded-[10px] bg-fill-subtle">
          <div className="relative aspect-[9/16] w-full">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="text-caption text-content-faint">
                  {failed ? "No se ha podido crear" : "Creando la imagen…"}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto mt-6 w-full max-w-[340px] space-y-2.5">
          <button
            onClick={share}
            disabled={!file || busy}
            className="pressable flex h-12 w-full items-center justify-center gap-2 rounded-control bg-paper text-body font-medium text-ink disabled:opacity-35"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M8 11V2.5 M4.8 5.4 L8 2.2 L11.2 5.4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M3 9.5v3.2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Compartir imagen
          </button>

          <button
            onClick={download}
            disabled={!file}
            className="pressable flex h-12 w-full items-center justify-center rounded-control border border-line-strong text-body text-paper disabled:opacity-35"
          >
            Guardar en el carrete
          </button>

          <button
            onClick={copy}
            className="pressable flex h-12 w-full items-center justify-center rounded-control text-body text-content-secondary transition-colors hover:text-paper"
          >
            Copiar enlace
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/** A blob URL that is revoked when the blob changes or the sheet goes away. */
function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return setUrl(null);
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}
