import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Facebook, Instagram, Mail, MapPin, Phone, Twitter, Youtube } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { useCategories } from "@/hooks/use-categories";
import { useSettings } from "@/hooks/use-settings";
import { api } from "@/lib/api";
import type { CmsPage } from "@/lib/types";

const linkClass = "text-sm text-muted-foreground transition-colors hover:text-foreground";

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav className="space-y-3" aria-label={title}>
      <h3 className="text-sm font-bold">{title}</h3>
      <ul className="space-y-2">{children}</ul>
    </nav>
  );
}

export function Footer() {
  const settings = useSettings();
  const { tree } = useCategories();
  const { data: pages = [] } = useQuery({
    queryKey: ["cms-pages"],
    queryFn: () => api<{ pages: CmsPage[] }>("/public/pages").then((response) => response.pages),
    staleTime: 10 * 60 * 1000,
  });

  const pagesIn = (group: CmsPage["footerGroup"]) =>
    pages.filter((page) => page.footerGroup === group);
  const socials = [
    { url: settings.social.instagram, icon: Instagram, label: "Instagram" },
    { url: settings.social.facebook, icon: Facebook, label: "Facebook" },
    { url: settings.social.x, icon: Twitter, label: "X" },
    { url: settings.social.youtube, icon: Youtube, label: "YouTube" },
  ].filter((social) => social.url);

  return (
    <footer className="mt-16 border-t border-border bg-card">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)] lg:px-8">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            {settings.tagline}. Authentic products from verified UAE sellers, delivered across all
            seven emirates.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0" />
              <a
                href={`tel:${settings.supportPhone.replace(/\s/g, "")}`}
                className="hover:text-foreground"
              >
                {settings.supportPhone}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0" />
              <a href={`mailto:${settings.supportEmail}`} className="hover:text-foreground">
                {settings.supportEmail}
              </a>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{settings.address}</span>
            </li>
          </ul>
          {socials.length > 0 && (
            <div className="flex gap-2">
              {socials.map(({ url, icon: Icon, label }) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="grid h-9 w-9 place-items-center rounded-full border border-border transition-colors hover:bg-accent"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          )}
        </div>

        <Column title="Shop">
          {tree.map((category) => (
            <li key={category._id}>
              <Link to="/category/$slug" params={{ slug: category.slug }} className={linkClass}>
                {category.name}
              </Link>
            </li>
          ))}
        </Column>

        <Column title="Help">
          <li>
            <Link to="/account" search={{ tab: "orders" }} className={linkClass}>
              Track your order
            </Link>
          </li>
          {pagesIn("Help").map((page) => (
            <li key={page._id}>
              <Link to="/pages/$slug" params={{ slug: page.slug }} className={linkClass}>
                {page.title}
              </Link>
            </li>
          ))}
          <li>
            <Link to="/contact" className={linkClass}>
              Contact us
            </Link>
          </li>
        </Column>

        <Column title="Company">
          {pagesIn("Company").map((page) => (
            <li key={page._id}>
              <Link to="/pages/$slug" params={{ slug: page.slug }} className={linkClass}>
                {page.title}
              </Link>
            </li>
          ))}
        </Column>

        <Column title="Policies">
          {pagesIn("Policies").map((page) => (
            <li key={page._id}>
              <Link to="/pages/$slug" params={{ slug: page.slug }} className={linkClass}>
                {page.title}
              </Link>
            </li>
          ))}
        </Column>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} {settings.storeName}. All prices in AED.
            {settings.trn ? ` VAT TRN ${settings.trn}.` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {["Visa", "Mastercard", "Cash on Delivery", "Smart Deal Wallet"].map((method) => (
              <span
                key={method}
                className="rounded-md border border-border px-2 py-1 font-semibold"
              >
                {method}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
