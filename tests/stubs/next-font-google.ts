// `next/font/google` is a compile-time macro that only the Next.js bundler can resolve;
// imported from a plain vitest run it is not callable. This stub stands in for it so
// modules that configure a font at import time (app/layout.tsx) stay unit-testable.
// Add an export here for each Google font the app loads.

interface StubbedFont {
  className: string;
  variable: string;
  style: { fontFamily: string };
}

interface FontOptions {
  variable?: string;
}

// Mirrors the shape next/font returns: a class name, an optional CSS-variable class, and a style object
function stubFont({ variable }: FontOptions = {}): StubbedFont {
  return {
    className: "font-stub",
    variable: variable ? `${variable.replace(/^--/, "")}-stub` : "",
    style: { fontFamily: "stub" },
  };
}

export const Hanken_Grotesk = stubFont;
