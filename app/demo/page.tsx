import ShelfApp from "@/components/ShelfApp";

export const metadata = {
  title: "Demo",
  description: "La estantería completa, sin cuenta: todo vive en tu navegador.",
  robots: { index: false },
};

/** The shelf without an account: everything works, nothing leaves the browser. */
export default function DemoPage() {
  return <ShelfApp />;
}
