import { redirect } from "next/navigation";

/**
 * The singular, because half the people typing it will.
 *
 * A link somebody reads out loud or half-remembers is worth catching: the
 * plural is the address, and this is the near miss that would otherwise land
 * on a 404 — however good that 404 is.
 */
export default function LinkSingular() {
  redirect("/links");
}
