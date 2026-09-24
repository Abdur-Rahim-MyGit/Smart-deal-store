import { useEffect, useState } from "react";
import logoMark from "@/assets/logo-mark.png";
import { cn } from "@/lib/utils";

const SPLASH_SESSION_KEY = "smartdeal.splash_viewed";

/**
 * Premium luxury splash screen for Smart Deal Store.
 * Features an Islamic geometric aura, smooth emblem reveal, Arabic calligraphy,
 * and a synchronized gold progress line before dissolving into the storefront.
 */
export function SplashScreen({ forceShow = false }: { forceShow?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Only show once per session unless forced (e.g. testing)
    const hasSeenSplash = window.sessionStorage.getItem(SPLASH_SESSION_KEY);
    if (hasSeenSplash && !forceShow) {
      return;
    }

    setVisible(true);
    window.sessionStorage.setItem(SPLASH_SESSION_KEY, "true");

    // Animate progress bar from 0% to 100%
    const progressTimer = setTimeout(() => {
      setProgress(100);
    }, 150);

    // Start fade out after 2.1 seconds
    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, 2100);

    // Completely unmount after fade transition completes (2.7s total)
    const removeTimer = setTimeout(() => {
      setVisible(false);
    }, 2750);

    return () => {
      clearTimeout(progressTimer);
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [forceShow]);

  if (!visible) return null;

  function dismiss() {
    setFading(true);
    setTimeout(() => setVisible(false), 400);
  }

  return (
    <div
      onClick={dismiss}
      role="dialog"
      aria-label="Welcome to Smart Deal"
      className={cn(
        "fixed inset-0 z-9999 flex flex-col items-center justify-center overflow-hidden bg-[#170B07] text-white transition-all duration-700 select-none cursor-pointer",
        fading ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100",
      )}
      style={{
        background: "radial-gradient(circle at center, #2F170E 0%, #1A0C07 55%, #100603 100%)",
      }}
    >
      {/* Background Animated Subtle Islamic Geometric Star Ray Effect */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
        <div className="h-[520px] w-[520px] rounded-full border border-amber-400/25 animate-splash-spin-slow" />
        <div
          className="absolute h-[420px] w-[420px] rotate-45 border border-amber-300/20 animate-splash-spin-slow"
          style={{ animationDirection: "reverse", animationDuration: "35s" }}
        />
        <div className="absolute h-[320px] w-[320px] rounded-full bg-amber-500/10 blur-3xl animate-splash-glow" />
      </div>

      {/* Main Luxury Lockup */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm">
        {/* Glowing Logo Container */}
        <div className="relative mb-6 flex items-center justify-center">
          {/* Outer Pulsing Glow Ring */}
          <div className="absolute -inset-4 rounded-3xl bg-linear-to-tr from-amber-600/30 via-amber-400/20 to-amber-600/30 blur-xl animate-splash-glow" />

          {/* Golden Border Frame */}
          <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-[#23120B] p-1.5 shadow-2xl ring-2 ring-amber-400/50 transition-transform duration-700 hover:scale-105">
            <img
              src={logoMark}
              alt="Smart Deal Emblem"
              width={96}
              height={96}
              className="h-full w-full object-cover rounded-[14px]"
            />
          </div>
        </div>

        {/* Brand Name Typography */}
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-1 drop-shadow-md">
          Smart<span className="text-amber-400">Deal</span>
        </h1>

        {/* Arabic Calligraphy Subtext */}
        <p className="font-semibold text-lg text-amber-200/90 tracking-widest mb-2 font-serif">
          صفقة ذكية
        </p>

        {/* Tagline */}
        <p className="text-xs uppercase tracking-[0.25em] text-amber-100/60 font-medium mb-8">
          UAE &bull; Luxury Multi-Vendor Store
        </p>

        {/* Sleek Golden Progress Indicator */}
        <div className="w-48 h-1 overflow-hidden rounded-full bg-white/10 p-0.5">
          <div
            className="h-full rounded-full bg-linear-to-r from-amber-500 via-amber-300 to-amber-500 transition-all duration-1800 ease-out shadow-[0_0_8px_rgba(251,191,36,0.8)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        <span className="mt-4 text-[10px] text-amber-200/40 tracking-wider">
          Tap anywhere to skip
        </span>
      </div>
    </div>
  );
}
