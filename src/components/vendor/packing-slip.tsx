import { useEffect } from "react";
import { createPortal } from "react-dom";
import { formatDate } from "@/lib/format";
import { variantLabel } from "@/components/vendor/common";
import type { VendorOrder } from "@/components/vendor/types";

/**
 * Print-only packing slip.
 *
 * The slip is portalled to <body> and every other top-level node is hidden while
 * printing, so the seller gets a clean A4 sheet with their own items only —
 * no prices and nothing from other sellers on the same order.
 */
const PRINT_CSS = `@media print {
  body > *:not(#sd-packing-slip) { display: none !important; }
  #sd-packing-slip { display: block !important; }
  @page { margin: 14mm; }
}`;

export function PackingSlip({
  order,
  storeName,
  onDone,
}: {
  order: VendorOrder;
  storeName: string;
  onDone: () => void;
}) {
  useEffect(() => {
    const start = window.setTimeout(() => {
      window.print();
      window.setTimeout(onDone, 500);
    }, 80);
    const afterPrint = () => onDone();
    window.addEventListener("afterprint", afterPrint);
    return () => {
      window.clearTimeout(start);
      window.removeEventListener("afterprint", afterPrint);
    };
  }, [onDone]);

  if (typeof document === "undefined") return null;
  const address = order.shippingAddress;

  return createPortal(
    <div id="sd-packing-slip" className="hidden bg-white p-8 text-black">
      <style>{PRINT_CSS}</style>

      <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-4">
        <div>
          <p className="text-2xl font-extrabold tracking-tight">Smart Deal</p>
          <p className="text-sm">Multi-vendor marketplace · United Arab Emirates</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold uppercase">Packing slip</p>
          <p className="font-mono text-sm">{order.orderId}</p>
          <p className="text-sm">
            {formatDate(order.createdAt, { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-8">
        <div>
          <p className="text-xs font-bold uppercase">Deliver to</p>
          <p className="mt-1 font-semibold">{address.receiverName}</p>
          <p className="text-sm">{address.receiverPhone}</p>
          <p className="mt-1 text-sm">
            {address.buildingDetails}
            {address.street ? `, ${address.street}` : ""}
          </p>
          <p className="text-sm">
            {address.area}, {address.emirate}
          </p>
          {address.landmark && <p className="text-sm">Landmark: {address.landmark}</p>}
          {order.deliveryInstructions && (
            <p className="mt-2 text-sm italic">Note: {order.deliveryInstructions}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-bold uppercase">Shipped by</p>
          <p className="mt-1 font-semibold">{storeName}</p>
          {order.shippingMethod && (
            <p className="mt-2 text-sm">
              {order.shippingMethod.label} — {order.shippingMethod.eta}
            </p>
          )}
          <p className="mt-2 text-sm">
            Payment: {order.paymentDetails.method} ({order.paymentDetails.status})
          </p>
        </div>
      </section>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-black text-left">
            <th className="py-2 font-bold">Item</th>
            <th className="py-2 font-bold">SKU</th>
            <th className="py-2 text-right font-bold">Qty</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item._id} className="border-b border-black/20 align-top">
              <td className="py-2 pr-4">
                <span className="font-semibold">{item.title}</span>
                {variantLabel(item.options, item.variantLabel) && (
                  <span className="block text-xs">
                    {variantLabel(item.options, item.variantLabel)}
                  </span>
                )}
              </td>
              <td className="py-2 pr-4 font-mono text-xs">{item.variantSku}</td>
              <td className="py-2 text-right font-bold">{item.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="mt-6 border-t border-black/20 pt-3 text-xs">
        <p>
          {order.items.reduce((sum, item) => sum + item.qty, 0)} unit(s) across {order.items.length}{" "}
          line(s). Please check the contents against this slip before sealing the parcel.
        </p>
        <p className="mt-1">
          Items from other sellers on this order ship separately and are not listed here. Questions?
          support@smartdeal.ae
        </p>
      </footer>
    </div>,
    document.body,
  );
}
