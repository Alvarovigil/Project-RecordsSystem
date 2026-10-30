/**
 * Only here for the title.
 *
 * The page is a client component, and a client component cannot export
 * metadata: without this the tab read the site's generic «Rackr Club — …»,
 * which is the one name that says nothing about where you are.
 */
export const metadata = { title: "Ajustes", robots: { index: false } };

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
