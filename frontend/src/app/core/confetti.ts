import confetti from 'canvas-confetti';

const COLORS = ['#008ACE', '#7EC8E8', '#E3F2FD', '#F5C542'];

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function fireConfettiBurst(): void {
  if (prefersReducedMotion()) return;

  const colors = COLORS;
  void confetti({
    colors,
    disableForReducedMotion: true,
    particleCount: 90,
    spread: 70,
    startVelocity: 48,
    origin: { y: 0.18 },
  });
  window.setTimeout(() => {
    void confetti({
      colors,
      disableForReducedMotion: true,
      particleCount: 55,
      spread: 100,
      origin: { x: 0.2, y: 0.22 },
    });
  }, 120);
  window.setTimeout(() => {
    void confetti({
      colors,
      disableForReducedMotion: true,
      particleCount: 55,
      spread: 100,
      origin: { x: 0.8, y: 0.22 },
    });
  }, 240);
}
