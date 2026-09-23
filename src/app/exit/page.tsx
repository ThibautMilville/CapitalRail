"use client";

import { useEffect } from "react";

/** Bookmarks to /exit land on the home Exit panel. */
export default function ExitRedirectPage() {
  useEffect(() => {
    window.location.replace("/#exit");
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center text-slate-400">
      <p className="m-0 text-sm">Redirecting to Exit...</p>
      <a
        href="/#exit"
        className="mt-3 text-cyan-200 underline-offset-2 hover:underline"
      >
        Continue to Exit
      </a>
    </div>
  );
}
