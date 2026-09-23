import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  title?: string;
};

const base = {
  viewBox: "0 0 16 16",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": true as const,
};

/**
 * Compact stroke icons for primary CTAs. currentColor, readable at 14-16px.
 */
export function IconWallet({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg {...base} className={className} {...props}>
      <path
        d="M2.5 4.5 H11.5 A1.5 1.5 0 0 1 13 6 V12 A1.5 1.5 0 0 1 11.5 13.5 H2.5 A1.5 1.5 0 0 1 1 12 V6 A1.5 1.5 0 0 1 2.5 4.5 Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path
        d="M1.5 6.5 H13"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path
        d="M11 9.25 H12.5"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconSearch({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg {...base} className={className} {...props}>
      <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.35" />
      <path
        d="M10.25 10.25 L13.5 13.5"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconShieldCheck({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg {...base} className={className} {...props}>
      <path
        d="M8 1.75 L13 3.75 V7.6 C13 10.6 10.7 13.2 8 14.25 C5.3 13.2 3 10.6 3 7.6 V3.75 Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path
        d="M5.75 8 L7.25 9.5 L10.5 6"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconDeposit({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg {...base} className={className} {...props}>
      <path
        d="M8 2.5 V10.5"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path
        d="M5 7.5 L8 10.5 L11 7.5"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 13.25 H13"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconSend({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg {...base} className={className} {...props}>
      <path
        d="M2.5 8 L13.5 2.75 L9.25 13.25 L7.5 9 L2.5 8 Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 9 L13.5 2.75"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconCopy({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg {...base} className={className} {...props}>
      <rect
        x="5.5"
        y="5.5"
        width="7.5"
        height="8"
        rx="1.25"
        stroke="currentColor"
        strokeWidth="1.35"
      />
      <path
        d="M10.5 5.25 V4 A1.25 1.25 0 0 0 9.25 2.75 H4 A1.25 1.25 0 0 0 2.75 4 V9.25 A1.25 1.25 0 0 0 4 10.5 H5.25"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconRefresh({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg {...base} className={className} {...props}>
      <path
        d="M13 8 A5 5 0 1 1 11.5 4.1"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path
        d="M11 2.5 L11.6 4.6 L9.4 5.1"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconSpark({ className = "h-4 w-4", ...props }: IconProps) {
  return (
    <svg {...base} className={className} {...props}>
      <path
        d="M8 2.25 L9.1 6.1 L13 7.2 L9.1 8.3 L8 12.15 L6.9 8.3 L3 7.2 L6.9 6.1 Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}
