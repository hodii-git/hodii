/** Soft glow behind the header, used on every page. */
export function ColorGlow() {
  return (
    <div aria-hidden className="header-glow">
      <div className="header-glow-color" />
    </div>
  );
}
