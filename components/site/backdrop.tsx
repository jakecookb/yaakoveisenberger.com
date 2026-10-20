// A very faint, faded field of boxes behind every page: a gold grid centred on the page, with a few squares that
// slowly light up in the logo's colours (gold, violet, cyan). Fixed in place, so it drifts behind the content as you
// scroll. It's decoration only: no JS, no pointer events, and still under reduced-motion (the glow just stops).
// Put it inside a wrapper with `isolate` and give the content `relative`.

const TILE = 64;
type Tone = 'gold' | 'violet' | 'cyan';
const TONES: Record<Tone, string> = {
  gold: 'bg-[#c8a96a]/[0.07] shadow-[inset_0_0_0_1px_rgba(200,169,106,0.14)]',
  violet: 'bg-violet-400/[0.06] shadow-[inset_0_0_0_1px_rgba(167,139,250,0.13)]',
  cyan: 'bg-cyan-300/[0.05] shadow-[inset_0_0_0_1px_rgba(103,232,249,0.12)]',
};
// [columns from the centre, row from the top, colour, animation delay (s)] — squares sit exactly on the grid.
const CELLS: [number, number, Tone, number][] = [
  [-6, 1, 'gold', 0], [-3, 3, 'violet', 1.5], [-1, 0, 'cyan', 3], [2, 2, 'gold', 4.5], [5, 1, 'violet', 2], [7, 4, 'cyan', 5.5],
  [-8, 5, 'cyan', 3.5], [-5, 7, 'gold', 1], [1, 6, 'violet', 6], [4, 8, 'gold', 2.5], [8, 7, 'violet', 0.5], [-2, 10, 'cyan', 4],
  [6, 11, 'gold', 5], [-7, 12, 'violet', 3], [0, 13, 'gold', 1.8], [3, 14, 'cyan', 6.5],
];

export function SiteBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 [mask-image:radial-gradient(ellipse_80%_75%_at_50%_0%,black_20%,transparent_85%)]"
    >
      <div
        className="absolute inset-0 opacity-[0.55] [background-image:linear-gradient(to_right,rgba(200,169,106,0.16)_1px,transparent_1px),linear-gradient(to_bottom,rgba(200,169,106,0.16)_1px,transparent_1px)] [background-position:50%_0]"
        style={{ backgroundSize: `${TILE}px ${TILE}px` }}
      />
      {CELLS.map(([dx, dy, tone, delay]) => (
        <span
          key={`${dx}:${dy}`}
          className={`absolute animate-[box-glow_10s_ease-in-out_infinite] motion-reduce:animate-none ${TONES[tone]}`}
          style={{ width: TILE, height: TILE, left: `calc(50% - ${TILE / 2}px + ${dx * TILE}px)`, top: dy * TILE, animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  );
}
