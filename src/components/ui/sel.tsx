import { Children, isValidElement, useMemo, useState, type ReactElement, type ReactNode } from "react";
import { Pick, type PickOption } from "./pick";

type Change = { target: { value: string }; currentTarget: { value: string } };
type OptionEl = ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>;

const text = (n: ReactNode): string => Children.toArray(n).map((c) => (typeof c === "string" || typeof c === "number" ? String(c) : isValidElement(c) ? text((c.props as { children?: ReactNode }).children) : "")).join("");
const flatten = (n: ReactNode): OptionEl[] => Children.toArray(n).flatMap((c) => (isValidElement(c) ? ((c as ReactElement).type === "option" ? [c as OptionEl] : flatten((c.props as { children?: ReactNode }).children)) : []));

/**
 * A drop-in for the browser select that uses our own dropdown (same look as every filter). It takes the same `<option>` children and calls
 * `onChange` with `{ target: { value } }`, so existing code only needs the tag renamed.
 */
type SelProps = { value?: string | number | undefined; defaultValue?: string | number | undefined; onChange?: ((e: Change) => void) | undefined; children?: ReactNode; className?: string | undefined; id?: string | undefined; disabled?: boolean | undefined; "aria-label"?: string | undefined; name?: string | undefined; required?: boolean | undefined };

export function Sel({ value, defaultValue, onChange, children, className = "", id, disabled, "aria-label": ariaLabel, name, required }: SelProps) {
  const [inner, setInner] = useState(String(defaultValue ?? ""));
  const current = value !== undefined ? String(value) : inner;
  const opts = useMemo(() => flatten(children), [children]);
  const empty = opts.find((o) => String(o.props.value ?? text(o.props.children)) === "");
  const options: PickOption[] = opts.filter((o) => o !== empty && !o.props.disabled).map((o) => ({ value: String(o.props.value ?? text(o.props.children)), label: text(o.props.children) }));
  const label = ariaLabel ?? "Choose";
  return (
    <>
      {name && (required
        ? <input name={name} value={current} onChange={() => {}} required tabIndex={-1} aria-hidden className="pointer-events-none absolute h-0 w-0 opacity-0" />
        : <input type="hidden" name={name} value={current} />)}
      <Pick {...(id ? { id } : {})} {...(disabled !== undefined ? { disabled } : {})} label={label} {...(empty ? { clearLabel: text(empty.props.children) || label } : {})} value={current} className={className}
        onChange={(v) => { setInner(v); onChange?.({ target: { value: v }, currentTarget: { value: v } }); }} options={options} />
    </>
  );
}
