import { redirect } from "next/navigation";

/** The route used to live here; links shared before the rename still work. */
export default function OldShelfRoute() {
  redirect("/coleccion");
}
