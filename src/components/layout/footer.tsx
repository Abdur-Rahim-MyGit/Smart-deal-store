import { Facebook, Instagram, Twitter, Youtube } from "lucide-react";
import { Logo } from "@/components/brand/logo";

const columns = [
  {
    title: "Shop",
    links: ["Beauty & Makeup", "Skincare", "Perfumes", "Electronics", "Fashion", "Home & Kitchen"],
  },
  {
    title: "Help",
    links: ["Track your order", "Returns & refunds", "Shipping policy", "Contact support", "FAQs"],
  },
  {
    title: "Company",
    links: ["About Smart Deal", "Careers", "Press", "Sell on Smart Deal", "Affiliates"],
  },
  {
    title: "Policies",
    links: ["Terms of use", "Privacy policy", "Cookie policy", "Authenticity promise"],
  },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-card">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.3fr_repeat(4,1fr)] lg:px-8">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            Smart Deal is a curated marketplace for beauty, tech, fashion and daily essentials —
            authentic stock, honest pricing, two-day delivery.
          </p>
          <div className="flex gap-2">
            {[Instagram, Facebook, Twitter, Youtube].map((Icon, index) => (
              <span
                key={index}
                className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-border transition-colors hover:bg-accent"
              >
                <Icon className="h-4 w-4" />
              </span>
            ))}
          </div>
        </div>

        {columns.map((column) => (
          <nav key={column.title} className="space-y-3">
            <h3 className="text-sm font-bold">{column.title}</h3>
            <ul className="space-y-2">
              {column.links.map((link) => (
                <li key={link}>
                  <span className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {link}
                  </span>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Smart Deal Retail Pvt. Ltd. All rights reserved.</p>
          <p className="flex flex-wrap items-center gap-2">
            {["Visa", "Mastercard", "UPI", "Cash on Delivery"].map((method) => (
              <span
                key={method}
                className="rounded-md border border-border px-2 py-1 text-xs font-semibold"
              >
                {method}
              </span>
            ))}
          </p>
        </div>
      </div>
    </footer>
  );
}
