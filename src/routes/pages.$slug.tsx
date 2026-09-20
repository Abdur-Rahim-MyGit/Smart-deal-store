import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileQuestion, LifeBuoy, MessageCircle } from "lucide-react";
import { SiteLayout, PageContainer, Breadcrumbs } from "@/components/layout/site-layout";
import { InlineError } from "@/components/common/page-loader";
import { EmptyState } from "@/components/common/empty-state";
import { RichText } from "@/components/common/rich-text";
import { Button } from "@/components/ui/button";
import { api, ApiError, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { CmsPage } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pages/$slug")({
  // ?lang=ar shows the Arabic version when the page has one (shareable link).
  validateSearch: (search: Record<string, unknown>): { lang?: "ar" } =>
    search["lang"] === "ar" ? { lang: "ar" } : {},
  component: CmsPageRoute,
});

const GROUP_ORDER: Array<CmsPage["footerGroup"]> = ["Help", "Company", "Policies"];

const cmsPagesQuery = {
  queryKey: ["cms-pages"],
  queryFn: () => api<{ pages: CmsPage[] }>("/public/pages").then((response) => response.pages),
  staleTime: 10 * 60 * 1000,
};

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
      <div className="space-y-2 pt-4">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div
            key={index}
            className={cn(
              "h-3.5 animate-pulse rounded bg-muted",
              index % 3 === 2 ? "w-2/3" : "w-full",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function HelpCard() {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-foreground">
        <LifeBuoy className="h-5 w-5" />
      </span>
      <h2 className="mt-3 font-display text-base font-bold">Still need help?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Our UAE support team replies within one business day, every day from 9am to 10pm GST.
      </p>
      <Button asChild className="mt-4 w-full rounded-xl font-semibold">
        <Link to="/contact">
          <MessageCircle className="mr-1.5 h-4 w-4" /> Contact us
        </Link>
      </Button>
    </section>
  );
}

function CmsPageRoute() {
  const { slug } = Route.useParams();
  const { lang } = Route.useSearch();

  const pageQuery = useQuery({
    queryKey: ["page", slug],
    queryFn: () =>
      api<{ page: CmsPage }>(`/public/pages/${encodeURIComponent(slug)}`).then(
        (response) => response.page,
      ),
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 404) && failureCount < 2,
    staleTime: 5 * 60 * 1000,
  });
  const { data: allPages = [] } = useQuery(cmsPagesQuery);

  const page = pageQuery.data;
  const notFound =
    pageQuery.isError && pageQuery.error instanceof ApiError && pageQuery.error.status === 404;
  const others = allPages.filter((entry) => entry.slug !== slug);
  const hasArabic = Boolean(page?.titleAr?.trim() && page.contentAr?.trim());
  const arabic = hasArabic && lang === "ar";
  const title = arabic ? page?.titleAr : page?.title;
  const summary = arabic ? page?.summaryAr : page?.summary;
  const content = arabic ? page?.contentAr : page?.content;

  return (
    <SiteLayout>
      <PageContainer className="py-6 lg:py-8">
        <Breadcrumbs className="mb-4">
          {[
            <Link key="home" to="/">
              Home
            </Link>,
            title ?? "Page",
          ]}
        </Breadcrumbs>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <article className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-8">
            {pageQuery.isLoading ? (
              <PageSkeleton />
            ) : notFound ? (
              <EmptyState
                icon={FileQuestion}
                title="We couldn't find that page"
                description="The link may be out of date. Try one of our help pages instead, or get in touch."
                action={
                  <>
                    <Button asChild className="rounded-xl font-semibold">
                      <Link to="/">Go to home</Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-xl font-semibold">
                      <Link to="/contact">Contact support</Link>
                    </Button>
                  </>
                }
                className="border-0 bg-transparent"
              />
            ) : pageQuery.isError ? (
              <InlineError
                message={errorMessage(pageQuery.error)}
                onRetry={() => void pageQuery.refetch()}
              />
            ) : page ? (
              <div dir={arabic ? "rtl" : "ltr"} lang={arabic ? "ar" : "en"}>
                <header className="border-b border-border pb-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {arabic
                        ? "سمارت ديل"
                        : page.footerGroup === "None"
                          ? "Smart Deal"
                          : page.footerGroup}
                    </p>
                    {hasArabic && (
                      <div
                        role="group"
                        aria-label="Page language"
                        dir="ltr"
                        className="inline-flex rounded-lg border border-border p-0.5 text-xs"
                      >
                        <Link
                          to="/pages/$slug"
                          params={{ slug }}
                          search={{}}
                          aria-current={arabic ? undefined : "true"}
                          className={cn(
                            "rounded-md px-2.5 py-1",
                            arabic
                              ? "text-muted-foreground hover:text-foreground"
                              : "bg-primary font-semibold text-primary-foreground",
                          )}
                        >
                          English
                        </Link>
                        <Link
                          to="/pages/$slug"
                          params={{ slug }}
                          search={{ lang: "ar" }}
                          lang="ar"
                          aria-current={arabic ? "true" : undefined}
                          className={cn(
                            "rounded-md px-2.5 py-1",
                            arabic
                              ? "bg-primary font-semibold text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          العربية
                        </Link>
                      </div>
                    )}
                  </div>
                  <h1 className="mt-1.5 font-display text-2xl font-extrabold sm:text-3xl">
                    {title}
                  </h1>
                  {summary && (
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                      {summary}
                    </p>
                  )}
                  {page.updatedAt && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {arabic ? "آخر تحديث" : "Last updated"} {formatDate(page.updatedAt)}
                    </p>
                  )}
                </header>
                <div className="pt-6">
                  {content ? (
                    <RichText content={content} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      This page has no content yet — please check back soon.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </article>

          <aside className="space-y-4 lg:sticky lg:top-24">
            {others.length > 0 && (
              <nav
                aria-label="Other pages"
                className="hidden rounded-2xl border border-border bg-card p-5 shadow-soft lg:block"
              >
                <h2 className="font-display text-base font-bold">More from Smart Deal</h2>
                <div className="mt-4 space-y-5">
                  {GROUP_ORDER.map((group) => {
                    const grouped = others.filter((entry) => entry.footerGroup === group);
                    if (grouped.length === 0) return null;
                    return (
                      <div key={group}>
                        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                          {group}
                        </h3>
                        <ul className="mt-2 space-y-1.5">
                          {grouped.map((entry) => (
                            <li key={entry._id}>
                              <Link
                                to="/pages/$slug"
                                params={{ slug: entry.slug }}
                                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                              >
                                {entry.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </nav>
            )}

            <HelpCard />
          </aside>
        </div>
      </PageContainer>
    </SiteLayout>
  );
}
