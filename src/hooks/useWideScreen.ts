import { useEffect, useState } from "react";

/**
 * Whether the viewport is at least as wide as a CSS breakpoint.
 *
 * The feed's aside has always been hidden below `xl` with a class, which hid it
 * and did not mount it any less: its two queries — conversations and requests
 * — went out on every phone that opened Drops, for a column the phone never
 * draws. `matchMedia` asks the same question the class does, and the answer can
 * decide whether the column exists at all.
 *
 * Written as a general hook because the same mistake — hiding something with a
 * class while still mounting its requests — can be made on any page.
 */
export function useWideScreen(query = "(min-width: 1280px)"): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    // The query may have changed since the first render; ask once more.
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}