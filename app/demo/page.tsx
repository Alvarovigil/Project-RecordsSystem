import ShelfApp from "@/components/ShelfApp";

export const metadata = { title: "Rackr — Demo" };

/** The shelf without an account: everything works, nothing leaves the browser. */
export default function DemoPage() {
  return <ShelfApp />;
}
