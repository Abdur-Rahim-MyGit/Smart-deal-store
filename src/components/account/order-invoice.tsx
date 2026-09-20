import { formatDate, formatPrice } from "@/lib/format";
import type { Order, StoreSettings } from "@/lib/types";

/**
 * VAT-compliant tax invoice. Hidden on screen and revealed for printing, while
 * the surrounding storefront chrome is suppressed.
 */
export function OrderInvoice({ order, settings }: { order: Order; settings: StoreSettings }) {
  const address = order.billingAddress ?? order.shippingAddress;
  const { pricing } = order;

  return (
    <>
      <style>{`@media print {
  header, footer, nav { display: none !important; }
  body { background: #fff !important; }
  @page { margin: 14mm; }
}`}</style>

      <div className="hidden bg-white p-0 text-black print:block">
        <header className="flex items-start justify-between gap-6 border-b border-black/20 pb-4">
          <div>
            <h1 className="font-display text-2xl font-extrabold">{settings.storeName}</h1>
            <p className="mt-1 max-w-xs text-[11px] leading-relaxed">{settings.address}</p>
            <p className="mt-1 text-[11px]">
              {settings.supportEmail} · {settings.supportPhone}
            </p>
            {settings.trn && <p className="mt-1 text-[11px] font-semibold">TRN: {settings.trn}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-extrabold tracking-wide uppercase">Tax Invoice</p>
            <p className="mt-1 text-[11px]">
              Invoice no: <span className="font-bold">{order.orderId}</span>
            </p>
            <p className="text-[11px]">Date: {formatDate(order.createdAt)}</p>
            <p className="text-[11px]">
              Payment: {order.paymentDetails.method} · {order.paymentDetails.status}
            </p>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-6">
          <div>
            <p className="text-[10px] font-bold tracking-wide uppercase">Bill to</p>
            <p className="mt-1 text-xs font-bold">{address.receiverName}</p>
            <p className="text-[11px] leading-relaxed">
              {address.buildingDetails}
              <br />
              {address.street}, {address.area}
              <br />
              {address.emirate}, United Arab Emirates
              <br />
              {address.receiverPhone}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-wide uppercase">Delivery</p>
            <p className="mt-1 text-[11px] leading-relaxed">
              {order.shippingMethod?.label ?? "Standard delivery"}
              {order.shippingMethod?.eta ? ` · ${order.shippingMethod.eta}` : ""}
              {order.shippingDetails?.carrier ? (
                <>
                  <br />
                  Carrier: {order.shippingDetails.carrier}
                </>
              ) : null}
              {order.shippingDetails?.trackingNumber ? (
                <>
                  <br />
                  Tracking: {order.shippingDetails.trackingNumber}
                </>
              ) : null}
            </p>
          </div>
        </section>

        <table className="mt-5 w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-y border-black/20 text-left">
              <th className="py-2 pr-2 font-bold">Description</th>
              <th className="py-2 pr-2 text-center font-bold">Qty</th>
              <th className="py-2 pr-2 text-right font-bold">Unit price</th>
              <th className="py-2 text-right font-bold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item._id} className="border-b border-black/10 align-top">
                <td className="py-2 pr-2">
                  <span className="font-semibold">{item.title}</span>
                  {item.variantLabel && (
                    <span className="block text-[10px]">{item.variantLabel}</span>
                  )}
                  <span className="block text-[10px]">SKU: {item.variantSku}</span>
                </td>
                <td className="py-2 pr-2 text-center">{item.qty}</td>
                <td className="py-2 pr-2 text-right">{formatPrice(item.price)}</td>
                <td className="py-2 text-right">{formatPrice(item.price * item.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-4 flex justify-end">
          <dl className="w-64 space-y-1 text-[11px]">
            <Row label="Subtotal" value={formatPrice(pricing.subtotal)} />
            {pricing.discount > 0 && (
              <Row
                label={order.couponCode ? `Discount (${order.couponCode})` : "Discount"}
                value={`− ${formatPrice(pricing.discount)}`}
              />
            )}
            <Row
              label="Delivery"
              value={pricing.shippingFee > 0 ? formatPrice(pricing.shippingFee) : "Free"}
            />
            {pricing.codFee > 0 && (
              <Row label="Cash on delivery fee" value={formatPrice(pricing.codFee)} />
            )}
            <Row label={`VAT (${pricing.vatRate}%)`} value={formatPrice(pricing.vat)} />
            <div className="flex justify-between border-t border-black/20 pt-1.5 text-sm font-extrabold">
              <dt>Total</dt>
              <dd>{formatPrice(pricing.total)}</dd>
            </div>
          </dl>
        </section>

        <footer className="mt-6 border-t border-black/20 pt-3 text-[10px] leading-relaxed">
          <p>
            This is a computer-generated tax invoice issued under UAE VAT law and is valid without a
            signature. VAT is charged at {pricing.vatRate}% on goods, delivery and any
            cash-on-delivery fee.
          </p>
          <p className="mt-1">
            Thank you for shopping with {settings.storeName}. For help with this order, contact{" "}
            {settings.supportEmail}.
          </p>
        </footer>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
