import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { cn } from "@/lib/utils";

/** Standard storefront frame: header, page content, footer and mobile tab bar. */
export function SiteLayout({
  children,
  mainClassName,
}: {
  children: ReactNode;
  mainClassName?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main id="main" className={cn("flex-1 pb-20 lg:pb-0", mainClassName)}>
        {children}
      </main>
      <Footer />
      <MobileTabBar />
    </div>
  );
}

export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}

/** Breadcrumb trail; pass links/labels as children in order. */
export function Breadcrumbs({
  children,
  className,
}: {
  children: ReactNode[];
  className?: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex flex-wrap items-center gap-1 text-xs text-muted-foreground", className)}
    >
      {children.map((child, index) => (
        <span key={index} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="h-3 w-3" />}
          <span
            className={cn(
              index === children.length - 1
                ? "max-w-[240px] truncate font-semibold text-foreground"
                : "hover:text-foreground",
            )}
          >
            {child}
          </span>
        </span>
      ))}
    </nav>
  );
}
