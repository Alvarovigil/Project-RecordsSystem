"use client";

import ErrorScreen from "@/components/app/ErrorScreen";

/** Lo que falle fuera de la app (la portada, los enlaces, el QR) tampoco enseña «Application error». */
export default function RootError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen {...props} outside />;
}
