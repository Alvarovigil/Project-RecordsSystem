/**
 * The one card in the product.
 *
 * A screen made of cards only reads as calm if every card is the same card:
 * one radius, one fill, one padding, one way of titling itself. The moment two
 * of them disagree by two pixels the page looks assembled rather than designed
 * — and that is exactly what happens when each screen invents its own box.
 *
 * The radius is larger than the artwork's (sleeves sit at 3px, because a real
 * sleeve is square). A card is not an object in the collection, it is a place
 * to put things, and the softer corner is what separates the two at a glance.
 */
export default function Card({
  title,
  action,
  children,
  padded = true,
}: {
  title?: string;
  /** a link or a control that belongs to this card's subject, top right */
  action?: React.ReactNode;
  children: React.ReactNode;
  /**
   * False when the content goes to the edges — a rail of covers, a list of
   * rows with their own press area. The card keeps its shape, the padding
   * moves inside.
   */
  padded?: boolean;
}) {
  return (
    <section
      className={`overflow-hidden rounded-[14px] bg-fill-subtle ${padded ? "p-5" : "py-5"}`}
    >
      {title && (
        <header
          className={`flex items-baseline justify-between gap-3 ${padded ? "" : "px-5"}`}
        >
          <h3 className="text-body font-medium text-paper">{title}</h3>
          {action}
        </header>
      )}
      <div className={title ? "mt-4" : ""}>{children}</div>
    </section>
  );
}
