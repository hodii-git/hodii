import { useEffect } from "react";

const set = (el: HTMLInputElement, v: string) => {
  // React tracks the value itself, so write through the native setter and announce it.
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, v);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

/** Site-wide input rules, so no form has to remember them: phone and number fields refuse letters as they are typed, and money fields group thousands (1500000 becomes 1,500,000). */
export function InputGuards() {
  useEffect(() => {
    const on = (e: Event) => {
      const el = e.target;
      if (!(el instanceof HTMLInputElement) || el.type === "number" || el.type === "password" || el.type === "file") return;
      const mode = el.inputMode, v = el.value;
      let next = v;
      if (el.type === "tel" || mode === "tel") next = v.replace(/[^\d+()\s-]/g, "");
      else if (mode === "numeric") next = el.dataset["money"] !== undefined ? formatMoney(v) : v.replace(/\D/g, "");
      else if (mode === "decimal") next = v.replace(/,/g, ".").replace(/(?!^)-/g, "").replace(/[^\d.-]/g, "").replace(/(\..*)\./g, "$1");
      if (next !== v) set(el, next);
    };
    document.addEventListener("input", on, true);
    return () => document.removeEventListener("input", on, true);
  }, []);
  return null;
}

const formatMoney = (v: string) => { const d = v.replace(/\D/g, ""); return d ? Number(d).toLocaleString("en-US") : ""; };
export const moneyDefault = (n: number | null | undefined) => (n === null || n === undefined ? "" : n.toLocaleString("en-US"));
