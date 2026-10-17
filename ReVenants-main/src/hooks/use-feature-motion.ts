import { useEffect, useRef } from "react";

const REVEAL_SELECTOR = "[data-feature-reveal]";

/**
 * Adds repeatable, viewport-based reveal behavior to a feature subtree.
 * The observer is intentionally scoped to the returned element so existing
 * dashboard sections and animations are unaffected.
 */
export function useFeatureMotion<T extends HTMLElement>() {
  const rootRef = useRef<T | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    root.classList.add("feature-motion-ready");
    const elements = new Set<HTMLElement>();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const revealImmediately = (element: HTMLElement) => {
      element.classList.add("is-visible");
      elements.add(element);
    };

    const observe = (element: HTMLElement) => {
      if (elements.has(element)) return;
      elements.add(element);
      if (reducedMotion || !("IntersectionObserver" in window)) {
        revealImmediately(element);
        return;
      }
      observer.observe(element);
    };

    const observer =
      reducedMotion || !("IntersectionObserver" in window)
        ? null
        : new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                (entry.target as HTMLElement).classList.toggle("is-visible", entry.isIntersecting);
              });
            },
            { threshold: 0.14, rootMargin: "-8% 0px -8% 0px" },
          );

    const scan = () => {
      root.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach(observe);
    };

    scan();
    const mutations = new MutationObserver(scan);
    mutations.observe(root, { childList: true, subtree: true });

    return () => {
      mutations.disconnect();
      observer?.disconnect();
      root.classList.remove("feature-motion-ready");
      elements.forEach((element) => element.classList.remove("is-visible"));
    };
  }, []);

  return rootRef;
}
