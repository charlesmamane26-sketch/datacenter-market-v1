/**
 * Sticky language preference. Set on an EXPLICIT choice — clicking the FR↔EN
 * switcher, or landing on an English page (a strong "I want English" signal).
 * The home page reads it to keep a returning EN visitor on the English home.
 *
 * Deliberately NOT driven by navigator.language: auto-redirecting by browser
 * language is an SEO anti-pattern (it bounces crawlers — often en-US — off the
 * French canonical). hreflang + the visible switcher are the recommended pattern.
 * Keying the redirect on an explicit stored choice leaves crawlers (no storage)
 * on the canonical home.
 */

const KEY = "dcm-lang";
export type Lang = "fr" | "en";

export function setLangPref(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // Storage unavailable (private mode) — the switch still works per-page.
  }
}

export function getLangPref(): Lang | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "fr" || v === "en" ? v : null;
  } catch {
    return null;
  }
}
