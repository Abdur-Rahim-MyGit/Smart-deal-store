import React from "react";
import { cn } from "@/lib/utils";

interface CartIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  variant?: "trolley" | "luxury-bag" | "modern-cart";
}

/**
 * Premium e-commerce cart icon tailored for Smart Deal's luxury aesthetic.
 * Features ultra-clean vector geometry with smooth radii and subtle luxury styling.
 */
export function CartIcon({
  className = "h-5 w-5",
  variant = "modern-cart",
  ...props
}: CartIconProps) {
  if (variant === "luxury-bag") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("transition-transform group-hover:scale-105", className)}
        {...props}
      >
        {/* Luxury boutique shopping bag with arched handle */}
        <path d="M6 8h12l1.2 12a2 2 0 0 1-2 2H6.8a2 2 0 0 1-2-2L6 8Z" />
        <path d="M9 10V6a3 3 0 0 1 6 0v4" />
        <path d="M10 13h4" strokeWidth="1.5" strokeOpacity="0.4" />
      </svg>
    );
  }

  if (variant === "trolley") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("transition-transform group-hover:scale-105", className)}
        {...props}
      >
        {/* Sleek modern grocery & mall trolley */}
        <path d="M2 3h3l2.4 11.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 6H6" />
        <circle cx="10" cy="20" r="1.5" fill="currentColor" />
        <circle cx="18" cy="20" r="1.5" fill="currentColor" />
      </svg>
    );
  }

  // Default: modern-cart (Balanced luxury hybrid cart icon)
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("transition-transform group-hover:scale-105", className)}
      {...props}
    >
      {/* Aerodynamic cart basket with rounded base and smooth wheel hubs */}
      <path d="M2.5 3.5h3.2l2.1 10.4a2 2 0 0 0 1.95 1.6h8.85a2 2 0 0 0 1.95-1.6l1.45-7.4H6.5" />
      <circle cx="10.5" cy="19.5" r="1.6" fill="currentColor" />
      <circle cx="17.5" cy="19.5" r="1.6" fill="currentColor" />
      <path d="M12 9h5" strokeWidth="1.5" strokeOpacity="0.35" />
    </svg>
  );
}
