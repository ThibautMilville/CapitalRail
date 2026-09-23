"use client";

import { useId, type SVGProps } from "react";

type CapitalRailMarkProps = SVGProps<SVGSVGElement> & {
  title?: string;
};

/**
 * CapitalRail mark - hex gate + dual rails.
 * Abstract silhouette, minimal soft-3D, readable at 16px.
 */
export function CapitalRailMark({
  title = "CapitalRail",
  className = "",
  ...props
}: CapitalRailMarkProps) {
  const uid = useId().replace(/:/g, "");
  const tile = `cr-tile-${uid}`;
  const mark = `cr-mark-${uid}`;
  const hi = `cr-hi-${uid}`;

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
      {...props}
    >
      <title>{title}</title>
      <defs>
        <linearGradient
          id={tile}
          x1="4"
          y1="2"
          x2="28"
          y2="30"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#0a242a" />
          <stop offset="1" stopColor="#02090d" />
        </linearGradient>
        <linearGradient
          id={mark}
          x1="6"
          y1="8"
          x2="26"
          y2="24"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#7af0d0" />
          <stop offset="0.55" stopColor="#36b8a6" />
          <stop offset="1" stopColor="#5ec8d8" />
        </linearGradient>
        <linearGradient
          id={hi}
          x1="8"
          y1="4"
          x2="22"
          y2="14"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#f0fff9" stopOpacity="0.55" />
          <stop offset="1" stopColor="#5beebe" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="8"
        fill={`url(#${tile})`}
        stroke={`url(#${mark})`}
        strokeWidth="1.35"
        strokeOpacity="0.55"
      />
      <path
        d="M8.5 4.2 H20.5 A6.2 6.2 0 0 1 26.7 10.4"
        stroke={`url(#${hi})`}
        strokeWidth="1.1"
        strokeLinecap="round"
      />

      {/* Hex gate */}
      <path
        d="M24.8 16 L20.6 23.4 L11.4 23.4 L7.2 16 L11.4 8.6 L20.6 8.6 Z"
        stroke={`url(#${mark})`}
        strokeWidth="2.15"
        strokeLinejoin="round"
      />

      {/* Open rail (through) */}
      <path
        d="M5.2 12.4 H26.8"
        stroke={`url(#${mark})`}
        strokeWidth="2.35"
        strokeLinecap="round"
      />
      {/* Dual / shorter rail */}
      <path
        d="M5.2 19.6 H21.2"
        stroke={`url(#${mark})`}
        strokeWidth="2.35"
        strokeLinecap="round"
        opacity="0.72"
      />
    </svg>
  );
}
