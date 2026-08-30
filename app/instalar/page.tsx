import InstallScreen from "@/components/install/InstallScreen";
import { SITE_URL } from "@/lib/site";

export const metadata = {
  title: "Instalar Rackr Club",
  description:
    "Tu colección de vinilos en la pantalla de inicio, sin tienda de aplicaciones.",
  alternates: { canonical: `${SITE_URL}/instalar` },
};

/**
 * The link you send to someone.
 *
 * Not the landing page with an install button bolted on: the landing explains
 * the product to a stranger who arrived by accident, and this is for somebody
 * a friend has already told — or who just pressed "Instalar la app" on the
 * phone door. So it does one job, in the shape of an app listing.
 * rackr.club/instalar, with /app as the short one you can say out loud.
 */
export default function InstalarPage() {
  return <InstallScreen url={`${SITE_URL}/instalar`} />;
}
