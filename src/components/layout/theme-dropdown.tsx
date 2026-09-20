import { useEffect, useState } from "react";
import { Check, Moon, Palette, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ThemeId = "default" | "espresso" | "sage";
export type ThemeMode = "light" | "dark";

export interface ThemeOption {
  id: ThemeId;
  name: string;
  subtitle: string;
  primaryColor: string;
  secondaryColor: string;
  badgeBorder?: string;
}

export const THEMES: ThemeOption[] = [
  {
    id: "default",
    name: "Default",
    subtitle: "Cyber Gold & Obsidian Ink",
    primaryColor: "#FEEE00",
    secondaryColor: "#232F3E",
    badgeBorder: "#E5E7EB",
  },
  {
    id: "espresso",
    name: "Espresso & Beige",
    subtitle: "Rich Velvet Espresso & Silk Nude",
    primaryColor: "#2D1912",
    secondaryColor: "#E8D3C3",
    badgeBorder: "#DFC5B2",
  },
  {
    id: "sage",
    name: "Vert Sauge & Ivoire",
    subtitle: "Forest Velvet Sage & Silk Ivory",
    primaryColor: "#2D4430",
    secondaryColor: "#F5EFEB",
    badgeBorder: "#CFDCce",
  },
];

const STORAGE_THEME_KEY = "smartdeal.theme_id";
const STORAGE_MODE_KEY = "smartdeal.theme_mode";

/** Custom Hook for accessing & mutating theme and light/dark mode */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>("default");
  const [isDark, setIsDarkState] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    // 1. Initial Theme Id
    const savedTheme = (window.localStorage.getItem(STORAGE_THEME_KEY) as ThemeId) || "default";
    const validTheme = THEMES.some((t) => t.id === savedTheme) ? savedTheme : "default";

    // 2. Initial Mode
    const savedMode = window.localStorage.getItem(STORAGE_MODE_KEY);
    const prefersDark =
      savedMode === "dark" ||
      (savedMode === null && window.matchMedia("(prefers-color-scheme: dark)").matches);

    setThemeState(validTheme);
    setIsDarkState(prefersDark);
    setMounted(true);

    // Apply to DOM
    applyThemeToDOM(validTheme, prefersDark);
  }, []);

  function applyThemeToDOM(t: ThemeId, dark: boolean) {
    const root = document.documentElement;
    if (t === "default") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", t);
    }
    root.classList.toggle("dark", dark);
  }

  function setTheme(nextTheme: ThemeId) {
    setThemeState(nextTheme);
    window.localStorage.setItem(STORAGE_THEME_KEY, nextTheme);
    applyThemeToDOM(nextTheme, isDark);
  }

  function setMode(dark: boolean) {
    setIsDarkState(dark);
    window.localStorage.setItem(STORAGE_MODE_KEY, dark ? "dark" : "light");
    applyThemeToDOM(theme, dark);
  }

  function toggleMode() {
    setMode(!isDark);
  }

  return {
    theme,
    isDark,
    mounted,
    setTheme,
    setMode,
    toggleMode,
    activeThemeMeta: THEMES.find((t) => t.id === theme) ?? (THEMES[0] as ThemeOption),
  };
}

/** Theme dropdown button with visual color swatches and mode toggle */
export function ThemeDropdown({
  className,
  showLabel = true,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const { theme, isDark, setTheme, setMode, activeThemeMeta } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "group relative flex h-9 items-center gap-2 rounded-xl px-2.5 text-xs font-semibold transition-all hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring sm:text-sm",
            className,
          )}
          aria-label={`Theme selector: currently ${activeThemeMeta.name}`}
        >
          <div className="relative flex items-center justify-center">
            <Palette className="h-4 w-4 transition-transform group-hover:rotate-12 text-foreground" />
            <span
              className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background"
              style={{ backgroundColor: activeThemeMeta.primaryColor }}
            />
          </div>

          {showLabel && (
            <span className="hidden items-center gap-1.5 md:flex">
              <span className="text-foreground">Theme</span>
              <span className="rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                {activeThemeMeta.name}
              </span>
            </span>
          )}

          {/* Miniature dual-color pill badge for instant visual recognition */}
          <div className="flex h-3.5 w-6 overflow-hidden rounded-full border border-border shadow-2xs">
            <div
              className="w-1/2 h-full"
              style={{ backgroundColor: activeThemeMeta.primaryColor }}
            />
            <div
              className="w-1/2 h-full"
              style={{ backgroundColor: activeThemeMeta.secondaryColor }}
            />
          </div>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-72 rounded-2xl border border-border bg-popover p-2 shadow-lift backdrop-blur-md"
      >
        <div className="px-2 py-1.5 flex items-center justify-between">
          <DropdownMenuLabel className="p-0 font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Color Palette
          </DropdownMenuLabel>
          <span className="text-[10px] font-semibold text-muted-foreground/80">
            3 Curated Themes
          </span>
        </div>

        <div className="space-y-1 my-1">
          {THEMES.map((item) => {
            const isSelected = theme === item.id;
            return (
              <DropdownMenuItem
                key={item.id}
                onClick={() => setTheme(item.id)}
                className={cn(
                  "relative flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 transition-all outline-none",
                  isSelected
                    ? "bg-accent/80 font-medium text-foreground shadow-xs ring-1 ring-border"
                    : "hover:bg-accent/50 text-foreground",
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Visual Color Pair Preview Swatch */}
                  <div
                    className="relative flex h-6 w-10 shrink-0 overflow-hidden rounded-full border shadow-2xs transition-transform group-hover:scale-105"
                    style={{ borderColor: item.badgeBorder || "var(--border)" }}
                  >
                    <div
                      className="w-1/2 h-full flex items-center justify-center"
                      style={{ backgroundColor: item.primaryColor }}
                    />
                    <div
                      className="w-1/2 h-full flex items-center justify-center"
                      style={{ backgroundColor: item.secondaryColor }}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs font-bold leading-tight">{item.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {item.subtitle}
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                )}
              </DropdownMenuItem>
            );
          })}
        </div>

        <DropdownMenuSeparator className="my-2" />

        {/* Mode switcher (Light / Dark) */}
        <div className="p-1">
          <div className="flex items-center justify-between rounded-xl bg-accent/40 p-1">
            <button
              type="button"
              onClick={() => setMode(false)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all",
                !isDark
                  ? "bg-card text-foreground shadow-xs ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Sun className="h-3.5 w-3.5 text-amber-500" />
              <span>Light</span>
            </button>
            <button
              type="button"
              onClick={() => setMode(true)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all",
                isDark
                  ? "bg-card text-foreground shadow-xs ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Moon className="h-3.5 w-3.5 text-indigo-400" />
              <span>Dark</span>
            </button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
