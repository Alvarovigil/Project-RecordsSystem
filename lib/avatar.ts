/**
 * A profile photo, small enough to carry.
 *
 * The phone hands over a 4 MB JPEG from a 12 MP sensor for something that is
 * rendered at 88 px. Uploading that untouched is the standard mistake: slow on
 * the connection least able to afford it, and — while the local backend is
 * still localStorage — instantly over quota.
 *
 * So it is resized here, in the browser, before it goes anywhere. Square, cover
 * cropped from the centre, 256 px (2× the largest place it appears), JPEG at
 * 0.82 — the point where the artefacts stop being visible at this size.
 *
 * The centre crop is a real decision and it can be wrong. It is right often
 * enough that offering a crop tool as the *default* step would cost everyone
 * time to fix the minority of cases; the honest fix is a "reencuadrar" option
 * later, not a mandatory editor now.
 */

const SIZE = 256;
const QUALITY = 0.82;

export async function fileToAvatar(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Eso no es una imagen.");
  }
  // 20 MB is not a photo, it is a mistake or an attack; refusing early beats
  // hanging the tab while the browser decodes it
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("La imagen es demasiado grande.");
  }

  const bitmap = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen.");

  // cover, cropped from the centre: the shortest side fills the square
  const side = Math.min(bitmap.width, bitmap.height);
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    SIZE,
    SIZE,
  );
  if ("close" in bitmap) (bitmap as ImageBitmap).close();

  return canvas.toDataURL("image/jpeg", QUALITY);
}

function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap decodes off the main thread where it exists, which is the
  // difference between a smooth sheet and a frozen one on a mid-range phone
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen."));
    };
    img.src = url;
  });
}
