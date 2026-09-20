import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import type { Order, StoreSettings } from "@/lib/types";

/**
 * VAT-compliant UAE tax invoice for an order.
 *
 * The document is portalled to a host element at the end of <body> that is
 * `hidden print:block`; a tiny print stylesheet hides the rest of the app so
 * the browser prints the invoice on its own pages.
 */

const customerOf = (order: Order) =>
  typeof order.user === "object" && order.user
    ? order.user
    : {
        _id: String(order.user),
        name: order.shippingAddress?.receiverName ?? "Customer",
        email: undefined,
        phone: undefined,
      };

function addressLines(order: Order): string[] {
  const address = order.billingAddress ?? order.shippingAddress;
  if (!address) return [];
  return [
    address.buildingDetails,
    address.street,
    address.area,
    address.emirate,
    "United Arab Emirates",
  ].filter((line): line is string => Boolean(line));
}

export function TaxInvoice({ order, settings }: { order: Order; settings: StoreSettings }) {
  const customer = customerOf(order);
  const pricing = order.pricing;
  const lines = addressLines(order);

  return (
    <article className="mx-auto max-w-[820px] bg-white p-8 text-[13px] leading-relaxed text-black print:max-w-none print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-black/80 pb-5">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">{settings.storeName}</h1>
          <p className="mt-1 max-w-[280px] text-[12px] text-black/70">{settings.address}</p>
          <p className="mt-1 text-[12px] text-black/70">
            {settings.supportEmail} · {settings.supportPhone}
          </p>
          {settings.trn ? (
            <p className="mt-1 text-[12px] font-semibold">
              TRN: <span className="font-mono">{settings.trn}</span>
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-lg font-extrabold tracking-[0.2em] uppercase">Tax Invoice</p>
          <table className="mt-2 ml-auto text-[12px]">
            <tbody>
              <tr>
                <td className="pr-3 text-black/60">Invoice no.</td>
                <td className="text-right font-mono font-semibold">{order.orderId}</td>
              </tr>
              <tr>
                <td className="pr-3 text-black/60">Invoice date</td>
                <td className="text-right font-semibold">{formatDate(order.createdAt)}</td>
              </tr>
              <tr>
                <td className="pr-3 text-black/60">Payment</td>
                <td className="text-right font-semibold">
                  {order.paymentDetails.method} · {order.paymentDetails.status}
                </td>
              </tr>
              <tr>
                <td className="pr-3 text-black/60">Order status</td>
                <td className="text-right font-semibold">{order.status}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </header>

      <section className="mt-5 grid grid-cols-2 gap-8">
        <div>
          <h2 className="text-[11px] font-bold tracking-wide text-black/50 uppercase">Bill to</h2>
          <p className="mt-1 font-semibold">{customer.name}</p>
          {customer.email ? <p className="text-[12px] text-black/70">{customer.email}</p> : null}
          {(customer.phone ?? order.shippingAddress?.receiverPhone) ? (
            <p className="text-[12px] text-black/70">
              {customer.phone ?? order.shippingAddress?.receiverPhone}
            </p>
          ) : null}
          {lines.map((line) => (
            <p key={line} className="text-[12px] text-black/70">
              {line}
            </p>
          ))}
        </div>
        <div>
          <h2 className="text-[11px] font-bold tracking-wide text-black/50 uppercase">
            Deliver to
          </h2>
          <p className="mt-1 font-semibold">{order.shippingAddress?.receiverName}</p>
          <p className="text-[12px] text-black/70">{order.shippingAddress?.receiverPhone}</p>
          <p className="text-[12px] text-black/70">
            {[
              order.shippingAddress?.buildingDetails,
              order.shippingAddress?.street,
              order.shippingAddress?.area,
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
          <p className="text-[12px] text-black/70">{order.shippingAddress?.emirate}</p>
          {order.shippingMethod ? (
            <p className="mt-1 text-[12px] text-black/70">
              {order.shippingMethod.label} · {order.shippingMethod.eta}
            </p>
          ) : null}
        </div>
      </section>

      <table className="mt-6 w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-y border-black/30 text-left">
            <th className="py-2 pr-2 font-bold">#</th>
            <th className="py-2 pr-2 font-bold">Description</th>
            <th className="py-2 pr-2 text-right font-bold">Qty</th>
            <th className="py-2 pr-2 text-right font-bold">Unit price</th>
            <th className="py-2 text-right font-bold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, index) => (
            <tr key={item._id} className="border-b border-black/10 align-top">
              <td className="py-2 pr-2 tabular-nums">{index + 1}</td>
              <td className="py-2 pr-2">
                <span className="block font-semibold">{item.title}</span>
                <span className="block text-black/60">
                  {[item.variantLabel, `SKU ${item.variantSku}`].filter(Boolean).join(" · ")}
                </span>
              </td>
              <td className="py-2 pr-2 text-right tabular-nums">{item.qty}</td>
              <td className="py-2 pr-2 text-right tabular-nums">{formatPrice(item.price)}</td>
              <td className="py-2 text-right tabular-nums">{formatPrice(item.price * item.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-5 flex justify-end">
        <table className="w-[320px] text-[12px]">
          <tbody>
            <tr>
              <td className="py-1 text-black/60">Subtotal (excl. VAT)</td>
              <td className="py-1 text-right tabular-nums">{formatPrice(pricing.subtotal)}</td>
            </tr>
            {pricing.discount > 0 && (
              <tr>
                <td className="py-1 text-black/60">
                  Discount{order.couponCode ? ` (${order.couponCode})` : ""}
                </td>
                <td className="py-1 text-right tabular-nums">−{formatPrice(pricing.discount)}</td>
              </tr>
            )}
            <tr>
              <td className="py-1 text-black/60">Delivery</td>
              <td className="py-1 text-right tabular-nums">
                {pricing.shippingFee > 0 ? formatPrice(pricing.shippingFee) : "Free"}
              </td>
            </tr>
            {pricing.codFee > 0 && (
              <tr>
                <td className="py-1 text-black/60">Cash on delivery fee</td>
                <td className="py-1 text-right tabular-nums">{formatPrice(pricing.codFee)}</td>
              </tr>
            )}
            <tr className="border-t border-black/20">
              <td className="py-1 text-black/60">Taxable amount</td>
              <td className="py-1 text-right tabular-nums">
                {formatPrice(pricing.taxableSubtotal)}
              </td>
            </tr>
            <tr>
              <td className="py-1 text-black/60">VAT @ {pricing.vatRate}%</td>
              <td className="py-1 text-right tabular-nums">{formatPrice(pricing.vat)}</td>
            </tr>
            <tr className="border-t-2 border-black/80">
              <td className="py-2 font-extrabold">Total (incl. VAT)</td>
              <td className="py-2 text-right font-extrabold tabular-nums">
                {formatPrice(pricing.total)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <footer className="mt-8 border-t border-black/20 pt-3 text-[11px] text-black/60">
        <p>
          This is a computer-generated tax invoice issued under UAE VAT law and is valid without a
          signature. All amounts are in UAE Dirhams (AED) and item prices are shown exclusive of
          VAT.
        </p>
        <p className="mt-1">
          Returns are accepted within {settings.returnWindowDays} days of delivery. Printed{" "}
          {formatDateTime(new Date())}.
        </p>
      </footer>
    </article>
  );
}

/** Mounts the invoice in a print-only host, fires window.print(), then calls onDone. */
export function PrintInvoice({
  order,
  settings,
  onDone,
}: {
  order: Order;
  settings: StoreSettings;
  onDone: () => void;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (typeof document === "undefined") return;
    const element = document.createElement("div");
    element.setAttribute("data-sd-print", "");
    element.className = "hidden print:block";
    document.body.appendChild(element);
    setHost(element);
    return () => {
      element.remove();
    };
  }, []);

  // Runs once per mount: lay the document out, print, then hand control back.
  useEffect(() => {
    if (!host) return;
    const finish = () => done.current();
    window.addEventListener("afterprint", finish);
    const timer = window.setTimeout(() => window.print(), 120);
    return () => {
      window.removeEventListener("afterprint", finish);
      window.clearTimeout(timer);
    };
  }, [host]);

  if (!host) return null;

  return createPortal(
    <>
      <style media="print">{`
        body > *:not([data-sd-print]) { display: none !important; }
        [data-sd-print] { display: block !important; }
        @page { size: A4; margin: 14mm; }
      `}</style>
      <TaxInvoice order={order} settings={settings} />
    </>,
    host,
  );
}
