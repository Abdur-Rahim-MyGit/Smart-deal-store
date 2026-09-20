import { useEffect, useState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  LifeBuoy,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  RotateCcw,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { SiteLayout, PageContainer, Breadcrumbs } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/context/store";
import { useSettings } from "@/hooks/use-settings";
import { api, errorMessage } from "@/lib/api";
import type { CmsPage } from "@/lib/types";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact us | Smart Deal" }] }),
  component: ContactPage,
});

const MAX_MESSAGE = 4000;

interface ContactValues {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

type ContactErrors = Partial<Record<keyof ContactValues, string>>;

const EMPTY: ContactValues = { name: "", email: "", phone: "", subject: "", message: "" };

function validate(values: ContactValues): ContactErrors {
  const errors: ContactErrors = {};
  if (values.name.trim().length < 2) errors.name = "Please enter your name";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim()))
    errors.email = "Enter a valid email address";
  if (values.phone.trim() && !/^\+?[\d\s-]{7,20}$/.test(values.phone.trim()))
    errors.phone = "Enter a valid phone number";
  if (values.subject.trim().length < 3) errors.subject = "Please add a subject";
  if (values.message.trim().length < 10)
    errors.message = "Please write at least 10 characters so we can help";
  return errors;
}

function InfoCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Mail;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-background p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-bold">{title}</p>
        <div className="text-sm break-words text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

function ContactPage() {
  const settings = useSettings();
  const { user, isAuthenticated } = useStore();

  const [values, setValues] = useState<ContactValues>(EMPTY);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Prefill from the session once it has been restored.
  useEffect(() => {
    if (!user) return;
    setValues((current) => ({
      ...current,
      name: current.name || user.name,
      email: current.email || user.email,
      phone: current.phone || (user.phone ?? ""),
    }));
  }, [user]);

  const { data: pages = [] } = useQuery({
    queryKey: ["cms-pages"],
    queryFn: () => api<{ pages: CmsPage[] }>("/public/pages").then((response) => response.pages),
    staleTime: 10 * 60 * 1000,
  });

  const faq = pages.find((page) => page.slug === "faq");
  const returns = pages.find((page) => page.slug.includes("return"));

  const set = <K extends keyof ContactValues>(key: K, value: ContactValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSending(true);
    try {
      const body: Record<string, unknown> = {
        name: values.name.trim(),
        email: values.email.trim(),
        subject: values.subject.trim(),
        message: values.message.trim(),
      };
      if (values.phone.trim()) body["phone"] = values.phone.trim();

      const data = await api<{ message?: string }>("/public/contact", { method: "POST", body });
      setSent(true);
      toast.success(data.message ?? "Thanks for reaching out!");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setSent(false);
    setValues({
      ...EMPTY,
      name: user?.name ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
    });
    setErrors({});
  }

  const field = (
    key: Exclude<keyof ContactValues, "message">,
    label: string,
    props: Omit<ComponentProps<typeof Input>, "value" | "onChange" | "id"> = {},
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`contact-${key}`}>{label}</Label>
      <Input
        id={`contact-${key}`}
        value={values[key]}
        onChange={(event) => set(key, event.target.value)}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] ? `contact-${key}-error` : undefined}
        className="h-10 rounded-xl"
        {...props}
      />
      {errors[key] && (
        <p id={`contact-${key}-error`} className="text-xs font-medium text-destructive">
          {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <SiteLayout>
      <PageContainer className="py-6 lg:py-8">
        <Breadcrumbs className="mb-4">
          {[
            <Link key="home" to="/">
              Home
            </Link>,
            "Contact us",
          ]}
        </Breadcrumbs>

        <div className="mb-6">
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">We're here to help</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Questions about an order, a return or selling on Smart Deal? Send us a message and our
            UAE team will get back to you within one business day.
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section
            aria-labelledby="contact-form-heading"
            className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6"
          >
            {sent ? (
              <div className="flex flex-col items-center py-10 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-success/12 text-success">
                  <CheckCircle2 className="h-7 w-7" />
                </span>
                <h2 id="contact-form-heading" className="mt-4 font-display text-xl font-bold">
                  Message sent
                </h2>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  Thanks for getting in touch — we'll reply within one business day at{" "}
                  <span className="font-semibold text-foreground">{values.email}</span>.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <Button variant="outline" className="rounded-xl font-semibold" onClick={reset}>
                    Send another message
                  </Button>
                  <Button asChild className="rounded-xl font-semibold">
                    <Link to="/">Continue shopping</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <h2 id="contact-form-heading" className="font-display text-lg font-extrabold">
                  Send us a message
                </h2>
                <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {field("name", "Your name", {
                      autoComplete: "name",
                      placeholder: "Fatima Al Suwaidi",
                    })}
                    {field("email", "Email address", {
                      type: "email",
                      autoComplete: "email",
                      placeholder: "you@example.com",
                    })}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {field("phone", "Phone (optional)", {
                      type: "tel",
                      autoComplete: "tel",
                      inputMode: "tel",
                      placeholder: "+971501234567",
                    })}
                    {field("subject", "Subject", { placeholder: "e.g. Where is my order?" })}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="contact-message">Message</Label>
                    <Textarea
                      id="contact-message"
                      value={values.message}
                      rows={6}
                      maxLength={MAX_MESSAGE}
                      onChange={(event) => set("message", event.target.value.slice(0, MAX_MESSAGE))}
                      aria-invalid={Boolean(errors.message)}
                      aria-describedby={errors.message ? "contact-message-error" : undefined}
                      placeholder="Tell us what happened, and include your order number if you have one."
                      className="rounded-xl"
                    />
                    <div className="flex items-center justify-between gap-3">
                      {errors.message ? (
                        <p
                          id="contact-message-error"
                          className="text-xs font-medium text-destructive"
                        >
                          {errors.message}
                        </p>
                      ) : (
                        <span />
                      )}
                      <p className="text-xs text-muted-foreground">
                        {values.message.length}/{MAX_MESSAGE}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="h-11 w-full rounded-xl font-bold sm:w-auto sm:px-8"
                    disabled={sending}
                  >
                    {sending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    {sending ? "Sending…" : "Send message"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    We only use your details to answer this enquiry. Read our{" "}
                    <Link
                      to="/pages/$slug"
                      params={{ slug: "privacy-policy" }}
                      className="font-semibold underline underline-offset-4"
                    >
                      privacy policy
                    </Link>
                    .
                  </p>
                </form>
              </>
            )}
          </section>

          <aside className="space-y-4">
            <section
              aria-labelledby="contact-details-heading"
              className="rounded-2xl border border-border bg-card p-5 shadow-soft"
            >
              <h2 id="contact-details-heading" className="font-display text-base font-bold">
                Talk to us directly
              </h2>
              <div className="mt-4 space-y-3">
                <InfoCard icon={Mail} title="Email support">
                  <a href={`mailto:${settings.supportEmail}`} className="hover:text-foreground">
                    {settings.supportEmail}
                  </a>
                </InfoCard>
                <InfoCard icon={Phone} title="Call us">
                  <a
                    href={`tel:${settings.supportPhone.replace(/\s/g, "")}`}
                    className="hover:text-foreground"
                  >
                    {settings.supportPhone}
                  </a>
                </InfoCard>
                <InfoCard icon={Clock} title="Opening hours">
                  Daily 9am–10pm GST
                </InfoCard>
                <InfoCard icon={MapPin} title="Head office">
                  {settings.address}
                </InfoCard>
              </div>
            </section>

            <section
              aria-labelledby="quick-links-heading"
              className="rounded-2xl border border-border bg-card p-5 shadow-soft"
            >
              <h2 id="quick-links-heading" className="font-display text-base font-bold">
                Answers in a hurry
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link
                    to="/pages/$slug"
                    params={{ slug: faq?.slug ?? "faq" }}
                    className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <MessageCircle className="h-4 w-4 shrink-0" />
                    {faq?.title ?? "Frequently asked questions"}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/pages/$slug"
                    params={{ slug: returns?.slug ?? "returns-and-refunds" }}
                    className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <RotateCcw className="h-4 w-4 shrink-0" />
                    {returns?.title ?? "Returns & refunds"}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/account"
                    search={{ tab: "orders" }}
                    className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Package className="h-4 w-4 shrink-0" />
                    Track an order
                  </Link>
                </li>
              </ul>
            </section>

            {isAuthenticated && (
              <section className="rounded-2xl border border-border bg-accent/40 p-5 shadow-soft">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-card text-foreground">
                  <LifeBuoy className="h-5 w-5" />
                </span>
                <h2 className="mt-3 font-display text-base font-bold">
                  Have an order-specific issue?
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Open a support ticket from your account and we'll link it to the order — you'll
                  get faster answers and can follow the whole conversation in one place.
                </p>
                <Button asChild className="mt-4 w-full rounded-xl font-semibold">
                  <Link to="/account" search={{ tab: "support" }}>
                    Open a support ticket
                  </Link>
                </Button>
              </section>
            )}
          </aside>
        </div>
      </PageContainer>
    </SiteLayout>
  );
}
