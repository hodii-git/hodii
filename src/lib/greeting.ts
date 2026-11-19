/** A greeting for the hour on the person's own clock. Through the small hours it stays "Good evening": "good night" is a goodbye, not a hello. */
export function greetingFor(hour: number): string {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 3 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  return "Good evening";
}
