/** A waving hand with yellow motion lines (the system emoji draws them blue). */
export function WaveHand({ className = "inline-block size-[1em] align-[-0.12em]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <path d="M3.5 9.5c-1.4 2-1.6 4.2-.6 6.2M6 6.8c-.7.9-1.2 1.8-1.5 2.8M28.5 22.5c1.4-2 1.6-4.2.6-6.2M26 25.2c.7-.9 1.2-1.8 1.5-2.8" fill="none" stroke="#F5B301" strokeWidth="1.8" strokeLinecap="round" />
      <path fill="#FFCB47" d="M11.2 8.4c.7-.7 1.8-.7 2.5 0l1.5 1.5-.2-1.4c-.1-1 .6-1.9 1.6-2 .8-.1 1.6.5 1.8 1.3l1.5 6.3 1.9-1.9c.8-.8 2-.8 2.8 0 .7.7.8 1.8.2 2.6l-4.6 6.9c-1.9 2.8-5.4 3.8-8.4 2.4-2.9-1.4-5-4.3-5.4-7.5l-.5-4.1c-.1-.9.5-1.7 1.4-1.8.6-.1 1.2.2 1.6.7l.9 1.2-.8-5.2c-.1-.9.5-1.7 1.3-1.8.7-.1 1.4.3 1.7.9l1.4 3.2.2-.8z" />
    </svg>
  );
}
