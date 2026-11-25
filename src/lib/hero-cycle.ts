import { useEffect, useState } from "react";

export const HERO_TEXT_MS = 8000;
export const HOME_FIRST_STEP_MS = HERO_TEXT_MS * 2;

/** The home welcome and original headline share the first progress stick. */
export function useHeroCycle(count: number, welcome = false) {
  const [frame, setFrame] = useState(0);
  const frames = count + (welcome ? 1 : 0);
  const step = welcome ? Math.max(0, frame - 1) : frame;
  useEffect(() => {
    const timer = setTimeout(() => setFrame((current) => (current + 1) % frames), HERO_TEXT_MS);
    return () => clearTimeout(timer);
  }, [frame, frames]);
  return {
    step,
    isWelcome: welcome && frame === 0,
    selectStep: (index: number) => setFrame(welcome && index > 0 ? index + 1 : index),
    duration: welcome && step === 0 ? HOME_FIRST_STEP_MS : HERO_TEXT_MS,
  };
}