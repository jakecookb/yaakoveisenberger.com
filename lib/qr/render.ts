import QRCode from 'qrcode';

// Draws the branded QR card: a dark frame (to match the site) around a light, high-contrast code that any phone camera can read,
// the logo in the centre and the site name underneath.

const TARGET = 1024;
const FRAME = 56;
const NAME_H = 128;
const PAD = 28; // extra light margin beyond the quiet zone, so the dark frame never crowds the code
const INK = '#0a0a0a';
const PAPER = '#fafaf9';
const GOLD = '#c8a96a';

const load = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const rounded = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

export type Rendered = { ok: true; logo: boolean } | { ok: false; error: string };

export async function renderQr(canvas: HTMLCanvasElement, text: string): Promise<Rendered> {
  let qr: ReturnType<typeof QRCode.create>;
  let withLogo = true;
  try {
    qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
  } catch {
    try {
      qr = QRCode.create(text, { errorCorrectionLevel: 'M' }); // very long text: no room for a logo, so drop it
      withLogo = false;
    } catch {
      return { ok: false, error: 'That is too long for a QR code — try something shorter.' };
    }
  }
  const [logo, wordmark] = await Promise.all([load('/images/home/logo-hd.png'), load('/images/home/wordmark-white.png')]);

  // Whole-pixel modules, at least 8 px each, so even a big code stays crisp and easy to scan.
  const n = qr.modules.size;
  const quiet = 4;
  const cell = Math.max(8, Math.floor((TARGET - FRAME * 2 - PAD * 2) / (n + quiet * 2)));
  const code = cell * (n + quiet * 2);
  const panel = code + PAD * 2;
  const w = panel + FRAME * 2;
  const SIZE = w;
  const h = SIZE + NAME_H;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // frame
  ctx.fillStyle = INK;
  rounded(ctx, 0, 0, w, h, 72);
  ctx.fill();
  const edge = ctx.createLinearGradient(0, 0, w, h);
  edge.addColorStop(0, 'rgba(200,169,106,0.55)');
  edge.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  edge.addColorStop(1, 'rgba(200,169,106,0.35)');
  ctx.strokeStyle = edge;
  ctx.lineWidth = 3;
  rounded(ctx, 1.5, 1.5, w - 3, h - 3, 70);
  ctx.stroke();

  // paper panel with the code
  ctx.fillStyle = PAPER;
  rounded(ctx, FRAME, FRAME, panel, panel, 40);
  ctx.fill();
  const origin = FRAME + PAD + quiet * cell;
  const finder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  ctx.fillStyle = INK;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.modules.get(r, c)) continue;
      const x = origin + c * cell;
      const y = origin + r * cell;
      if (finder(r, c)) ctx.fillRect(x - 0.4, y - 0.4, cell + 0.8, cell + 0.8);
      else if (n > 57) ctx.fillRect(x - 0.3, y - 0.3, cell + 0.6, cell + 0.6); // dense codes: plain squares
      else { rounded(ctx, x + cell * 0.04, y + cell * 0.04, cell * 0.92, cell * 0.92, cell * 0.3); ctx.fill(); }
    }
  }

  // logo badge in the centre (about 5% of the code's area, well within what error correction level H can repair)
  if (withLogo) {
    const badge = code * 0.22;
    const bx = w / 2 - badge / 2;
    const by = FRAME + panel / 2 - badge / 2;
    ctx.fillStyle = PAPER;
    rounded(ctx, bx - 10, by - 10, badge + 20, badge + 20, badge * 0.28);
    ctx.fill();
    ctx.fillStyle = INK;
    rounded(ctx, bx, by, badge, badge, badge * 0.22);
    ctx.fill();
    ctx.save();
    rounded(ctx, bx, by, badge, badge, badge * 0.22);
    ctx.clip();
    ctx.drawImage(logo, bx, by, badge, badge);
    ctx.restore();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 4;
    rounded(ctx, bx, by, badge, badge, badge * 0.22);
    ctx.stroke();
  }

  // site name
  const nameW = Math.min(w * 0.62, 560) * (w / TARGET > 1 ? w / TARGET : 1);
  const nameH = (nameW / wordmark.width) * wordmark.height;
  ctx.drawImage(wordmark, w / 2 - nameW / 2, SIZE - FRAME / 2 + (NAME_H - nameH) / 2 - 4, nameW, nameH);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '500 26px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('yaakoveisenberger.com', w / 2, h - 30);
  return { ok: true, logo: withLogo };
}
