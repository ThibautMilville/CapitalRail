"use client";

/** Delay step between letters - same stagger cadence as Cloak cloak.today hero. */
const LETTER_GLOW_STEP_S = 0.15;

function countLetters(text: string) {
  return Array.from(text).filter((char) => !/\s/.test(char)).length;
}

/** Letter-level staggered glow; words stay unbreakable (Cloak HeroGlowText). */
export function GlowTitle({
  text,
  accent = false,
  startIndex = 0,
  className = "",
}: {
  text: string;
  accent?: boolean;
  startIndex?: number;
  className?: string;
}) {
  let letterIndex = startIndex;

  return (
    <span className={className}>
      {text.split(/(\s+)/).map((token, tokenIndex) => {
        if (/^\s+$/.test(token)) {
          return (
            <span key={`space-${startIndex}-${tokenIndex}`}>{token}</span>
          );
        }

        return (
          <span
            key={`word-${startIndex}-${tokenIndex}`}
            className="whitespace-nowrap"
          >
            {Array.from(token).map((char, charIndex) => {
              const delay = `${(letterIndex * LETTER_GLOW_STEP_S).toFixed(2)}s`;
              letterIndex += 1;

              return (
                <span
                  key={`char-${startIndex}-${tokenIndex}-${charIndex}`}
                  className={`animated-gradient-word${accent ? " is-accent" : ""}`}
                  style={{ ["--glow-delay" as string]: delay }}
                >
                  {char}
                </span>
              );
            })}
          </span>
        );
      })}
    </span>
  );
}

export function BrandGlowTitle({
  lead,
  accent,
  className = "",
}: {
  lead: string;
  accent: string;
  className?: string;
}) {
  const leadLetterCount = countLetters(lead);

  /* Continuous CapitalRail wordmark - no gap so the color wave scrolls across both halves. */
  return (
    <span className={`whitespace-nowrap ${className}`.trim()}>
      <GlowTitle text={lead} />
      <GlowTitle text={accent} accent startIndex={leadLetterCount} />
    </span>
  );
}
