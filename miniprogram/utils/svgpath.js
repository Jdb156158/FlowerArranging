// 极简 SVG path 解释器：把 path d 字符串播放到 CanvasRenderingContext2D
// 支持 M/m L/l H/h V/v C/c Q/q T/t A/a Z/z（圆弧按 SVG 规范转贝塞尔）
function tokenize(d) {
  const re = /[MmLlHhVvCcQqTtAaZz]|-?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/g;
  return d.match(re) || [];
}

function arcToBeziers(cx, cy, rx, ry, phi, start, sweep) {
  // 中心参数化 → 三次贝塞尔段列表 [x1,y1,x2,y2,x,y]
  const segs = [];
  const n = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
  const delta = sweep / n;
  const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
  for (let i = 0; i < n; i++) {
    const t1 = start + i * delta, t2 = t1 + delta;
    const a = t1, b = t2;
    const alpha = 4 / 3 * Math.tan((b - a) / 4);
    const x1 = Math.cos(a), y1 = Math.sin(a);
    const x2 = Math.cos(b), y2 = Math.sin(b);
    const p = [
      [x1, y1],
      [x1 - alpha * y1, y1 + alpha * x1],
      [x2 + alpha * y2, y2 - alpha * x2],
      [x2, y2],
    ];
    const map = ([ux, uy]) => [
      cx + rx * ux * cosPhi - ry * uy * sinPhi,
      cy + rx * ux * sinPhi + ry * uy * cosPhi,
    ];
    const q = p.map(map);
    segs.push([q[1][0], q[1][1], q[2][0], q[2][1], q[3][0], q[3][1]]);
  }
  return segs;
}

function endpointArc(cx0, cy0, rx, ry, phiDeg, laf, sf, x, y) {
  // SVG endpoint → center 参数化（F.6.5）
  if (rx === 0 || ry === 0) return null;
  const phi = phiDeg * Math.PI / 180;
  const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
  const dx = (cx0 - x) / 2, dy = (cy0 - y) / 2;
  let x1p = cosPhi * dx + sinPhi * dy;
  let y1p = -sinPhi * dx + cosPhi * dy;
  rx = Math.abs(rx); ry = Math.abs(ry);
  let lam = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry);
  if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; }
  const sign = laf !== sf ? 1 : -1;
  let num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  num = Math.max(0, num);
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = sign * Math.sqrt(num / den);
  const cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (cx0 + x) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (cy0 + y) / 2;
  const ang = (ux, uy, vx, vy) => {
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
    let a = Math.acos(Math.min(1, Math.max(-1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sf && dt > 0) dt -= 2 * Math.PI;
  if (sf && dt < 0) dt += 2 * Math.PI;
  return arcToBeziers(cx, cy, rx, ry, phi, t1, dt);
}

// 把 path 字符串写入 ctx（不 beginPath，由调用方控制）
function pathTo(ctx, d) {
  const t = tokenize(d);
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, qx = 0, qy = 0;
  const num = () => parseFloat(t[i++]);
  while (i < t.length) {
    if (/[A-Za-z]/.test(t[i])) cmd = t[i++];
    const rel = cmd >= 'a' && cmd <= 'z';
    const C = cmd.toUpperCase();
    switch (C) {
      case 'M': {
        let nx = num(), ny = num();
        if (rel) { nx += x; ny += y; }
        x = nx; y = ny;
        ctx.moveTo(x, y); sx = x; sy = y;
        cmd = rel ? 'l' : 'L';
        break;
      }
      case 'L': {
        let nx = num(), ny = num();
        if (rel) { nx += x; ny += y; }
        ctx.lineTo(nx, ny); x = nx; y = ny; break;
      }
      case 'H': {
        let nx = num(); if (rel) nx += x;
        ctx.lineTo(nx, y); x = nx; break;
      }
      case 'V': {
        let ny = num(); if (rel) ny += y;
        ctx.lineTo(x, ny); y = ny; break;
      }
      case 'C': {
        let x1 = num(), y1 = num(), x2 = num(), y2 = num(), nx = num(), ny = num();
        if (rel) { x1 += x; y1 += y; x2 += x; y2 += y; nx += x; ny += y; }
        ctx.bezierCurveTo(x1, y1, x2, y2, nx, ny); x = nx; y = ny; break;
      }
      case 'Q': {
        let x1 = num(), y1 = num(), nx = num(), ny = num();
        if (rel) { x1 += x; y1 += y; nx += x; ny += y; }
        ctx.quadraticCurveTo(x1, y1, nx, ny); qx = x1; qy = y1; x = nx; y = ny; break;
      }
      case 'T': {
        let nx = num(), ny = num();
        if (rel) { nx += x; ny += y; }
        const rx1 = 2 * x - qx, ry1 = 2 * y - qy;
        ctx.quadraticCurveTo(rx1, ry1, nx, ny); qx = rx1; qy = ry1; x = nx; y = ny; break;
      }
      case 'A': {
        const rx = num(), ry = num(), rot = num(), laf = num(), sf = num();
        let nx = num(), ny = num();
        if (rel) { nx += x; ny += y; }
        const segs = endpointArc(x, y, rx, ry, rot, laf, sf, nx, ny);
        if (!segs) ctx.lineTo(nx, ny);
        else for (const s of segs) ctx.bezierCurveTo(s[0], s[1], s[2], s[3], s[4], s[5]);
        x = nx; y = ny; break;
      }
      case 'Z': {
        ctx.closePath(); x = sx; y = sy; break;
      }
      default:
        i++;
    }
  }
}

module.exports = { pathTo };
