import React, { useState, useEffect } from "react";

/**
 * <img> that walks through a list of candidate srcs on error.
 * When all candidates fail, renders nothing (or `fallback` if provided).
 *
 * Props:
 *   sources: string[]  — ordered list of URLs to try
 *   fallback: ReactNode — optional element shown when every source fails
 *   ...imgProps         — spread onto the <img>
 */
export default function FallbackImage({ sources = [], fallback = null, ...imgProps }) {
  const [idx, setIdx] = useState(0);

  // Reset when the source list identity changes (e.g. different driver)
  useEffect(() => {
    setIdx(0);
  }, [sources.join("|")]);

  if (idx >= sources.length) return fallback;

  return (
    <img
      {...imgProps}
      src={sources[idx]}
      onError={() => setIdx((i) => i + 1)}
    />
  );
}
