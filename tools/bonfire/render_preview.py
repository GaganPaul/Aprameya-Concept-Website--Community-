#!/usr/bin/env python3
"""Software preview: parses a .glb independently of the generator and rasterises it (z-buffer, Gouraud, PBR-ish lighting)."""
import json, struct, sys, math
import numpy as np
from PIL import Image

def load_glb(path):
    d = open(path, 'rb').read()
    magic, ver, total = struct.unpack('<4sII', d[:12]); assert magic == b'glTF' and ver == 2 and total == len(d)
    jl, jt = struct.unpack('<I4s', d[12:20]); js = json.loads(d[20:20+jl]); off = 20 + jl
    bl, bt = struct.unpack('<I4s', d[off:off+8]); bin_ = d[off+8:off+8+bl]
    return js, bin_

CT = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
def acc(js, bin_, i):
    a = js['accessors'][i]; v = js['bufferViews'][a['bufferView']]
    n = NC[a['type']]; arr = np.frombuffer(bin_, CT[a['componentType']], a['count'] * n, v['byteOffset'] + a.get('byteOffset', 0))
    arr = arr.reshape(-1, n) if n > 1 else arr
    return arr

def quat_to_mat(q):
    x, y, z, w = q
    return np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])

def flatten(js, bin_):
    """Return list of world-space (P, N, color_lin, material dict, idx)."""
    out = []
    def walk(ni, M):
        n = js['nodes'][ni]; L = np.eye(4)
        if 'rotation' in n: L[:3, :3] = quat_to_mat(n['rotation'])
        if 'translation' in n: L[:3, 3] = n['translation']
        W = M @ L
        if 'mesh' in n:
            for pr in js['meshes'][n['mesh']]['primitives']:
                P = acc(js, bin_, pr['attributes']['POSITION']).astype(float); N = acc(js, bin_, pr['attributes']['NORMAL']).astype(float)
                C = acc(js, bin_, pr['attributes']['COLOR_0']).astype(float) / 255.0
                I = acc(js, bin_, pr['indices']).astype(np.int64).reshape(-1, 3); mt = js['materials'][pr['material']]
                Pw = P @ W[:3, :3].T + W[:3, 3]; Nw = N @ W[:3, :3].T
                out.append((Pw, Nw, C[:, :3], mt, I, n['name']))
        for c in n.get('children', []): walk(c, W)
    for r in js['scenes'][js.get('scene', 0)]['nodes']: walk(r, np.eye(4))
    return out

def render(path, out_png, azim=0, elev=10, W=900, H=1000, ss=2, dist=7.2, fov=30, target=(0, 1.15, 0), glow=0.6, crop=None):
    js, bin_ = load_glb(path); items = flatten(js, bin_)
    tgt = np.array(target, float); az, el = math.radians(azim), math.radians(elev)
    cam = tgt + dist * np.array([math.sin(az) * math.cos(el), math.sin(el), math.cos(az) * math.cos(el)])
    f = (tgt - cam); f /= np.linalg.norm(f); r = np.cross(f, [0, 1, 0]); r /= np.linalg.norm(r); u = np.cross(r, f)
    w, h = W * ss, H * ss; focal = 0.5 * h / math.tan(math.radians(fov) / 2)
    lights = [(np.array([-0.55, 0.85, 0.75]), np.array([1.0, 0.90, 0.78]) * 1.9), (np.array([0.8, 0.35, -0.8]), np.array([0.40, 0.52, 0.85]) * 2.0),
              (np.array([0.7, 0.15, 0.8]), np.array([0.30, 0.30, 0.36]) * 0.6), (np.array([0.0, 1.0, -0.2]), np.array([0.2, 0.22, 0.28]) * 0.7)]
    lights = [(l / np.linalg.norm(l), c) for l, c in lights]
    glowp = np.array([0.0, 0.40, 0.15]); view_dirs = lambda P: (cam - P) / np.linalg.norm(cam - P, axis=1, keepdims=True)
    def shade(P, N, C, mt):
        pbr = mt['pbrMetallicRoughness']; base = np.array(pbr['baseColorFactor'][:3]); met = pbr['metallicFactor']; rough = pbr['roughnessFactor']
        alb = C * base; Nn = N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9); V = view_dirs(P)
        col = np.zeros_like(P)
        f0 = 0.04 * (1 - met) + alb * met; diff = alb * (1 - met)
        shin = max(4.0, (1 - rough) ** 2 * 260)
        for L, lc in lights:
            ndl = np.clip(Nn @ L, 0, 1)[:, None]; Hh = (V + L); Hh /= np.linalg.norm(Hh, axis=1, keepdims=True)
            spec = np.clip((Nn * Hh).sum(1), 0, 1)[:, None] ** shin * (shin + 8) / 60
            col += (diff / math.pi * 3.0 * ndl + f0 * spec * ndl) * lc
        # warm glow from the (future) fire
        gd = glowp - P; dd = np.linalg.norm(gd, axis=1, keepdims=True); gl = np.clip((Nn * gd / dd).sum(1), 0, 1)[:, None]
        col += diff / math.pi * 3.0 * gl * np.array([1.0, 0.42, 0.14]) * glow / (0.4 + dd ** 2 * 1.6)
        # ambient hemisphere + fake env reflection
        hemi = (0.5 + 0.5 * Nn[:, 1:2]); col += alb * (np.array([0.10, 0.11, 0.15]) * hemi + np.array([0.05, 0.04, 0.035]) * (1 - hemi)) * (1 - met * 0.8) * 2.2
        Rv = 2 * (Nn * V).sum(1, keepdims=True) * Nn - V; env = np.array([0.05, 0.05, 0.06]) + np.clip(Rv[:, 1:2] * 0.5 + 0.5, 0, 1) * np.array([0.22, 0.26, 0.34])
        col += f0 * env * (1 - rough * 0.55) * (1.0 + 2.0 * met)
        # cheap AO: darker near ground and inside the pile
        col *= (0.55 + 0.45 * np.clip(P[:, 1:2] / 0.45, 0, 1)) + 0.0
        col += np.array(mt.get('emissiveFactor', [0, 0, 0]))
        return col
    img = np.zeros((h, w, 3)); zb = np.full((h, w), np.inf)
    # background + ground
    yy, xx = np.mgrid[0:h, 0:w]; ray = ((xx - w / 2 + 0.5) / focal)[..., None] * r + (-(yy - h / 2 + 0.5) / focal)[..., None] * u + f
    ray /= np.linalg.norm(ray, axis=2, keepdims=True)
    bg = np.array([0.012, 0.012, 0.016]) + np.array([0.02, 0.02, 0.028]) * (1 - yy / h)[..., None]
    t = -cam[1] / np.where(ray[..., 1] < -1e-4, ray[..., 1], -1e-4); hit = (ray[..., 1] < -1e-4)
    gp = cam + ray * t[..., None]; rr = np.sqrt(gp[..., 0] ** 2 + gp[..., 2] ** 2)
    gcol = (np.array([0.035, 0.034, 0.04]) * np.exp(-(rr / 2.3) ** 2)[..., None]) * 1.0 + np.array([0.06, 0.025, 0.01]) * glow * np.exp(-(rr / 1.1) ** 2)[..., None]
    img[:] = np.where(hit[..., None], bg + gcol, bg)
    allP = []
    for P, N, C, mt, I, name in items:
        col = shade(P, N, C, mt)
        rel = P - cam; z = rel @ f; sx = (rel @ r) / z * focal + w / 2; sy = -(rel @ u) / z * focal + h / 2
        for tri in I:
            a, b, c = tri; x0, x1, x2 = sx[a], sx[b], sx[c]; y0, y1, y2 = sy[a], sy[b], sy[c]
            area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
            if abs(area) < 1e-9: continue
            # back-face cull (CCW front in glTF with y flipped on screen => area < 0 is front)
            if area > 0: continue
            xmin = max(int(math.floor(min(x0, x1, x2))), 0); xmax = min(int(math.ceil(max(x0, x1, x2))), w - 1)
            ymin = max(int(math.floor(min(y0, y1, y2))), 0); ymax = min(int(math.ceil(max(y0, y1, y2))), h - 1)
            if xmin > xmax or ymin > ymax: continue
            gx, gy = np.meshgrid(np.arange(xmin, xmax + 1) + 0.5, np.arange(ymin, ymax + 1) + 0.5)
            l0 = ((x1 - gx) * (y2 - gy) - (x2 - gx) * (y1 - gy)) / area; l1 = ((x2 - gx) * (y0 - gy) - (x0 - gx) * (y2 - gy)) / area; l2 = 1 - l0 - l1
            m = (l0 >= 0) & (l1 >= 0) & (l2 >= 0)
            if not m.any(): continue
            zz = 1.0 / (l0 / z[a] + l1 / z[b] + l2 / z[c]); sub = zb[ymin:ymax+1, xmin:xmax+1]; m &= zz < sub
            if not m.any(): continue
            pw0, pw1, pw2 = l0 / z[a], l1 / z[b], l2 / z[c]; s_ = pw0 + pw1 + pw2
            colp = (col[a][None, None] * (pw0 / s_)[..., None] + col[b][None, None] * (pw1 / s_)[..., None] + col[c][None, None] * (pw2 / s_)[..., None])
            sub[m] = zz[m]; img[ymin:ymax+1, xmin:xmax+1][m] = colp[m]
    img = img / (1 + img * 0.55); img = np.power(np.clip(img * 1.25, 0, 1), 1 / 2.2)
    im = Image.fromarray((img * 255).astype(np.uint8)).resize((W, H), Image.LANCZOS)
    if crop: im = im.crop(crop)
    im.save(out_png); return out_png

if __name__ == '__main__':
    p = sys.argv[1]; tag = sys.argv[2] if len(sys.argv) > 2 else 'prev'
    render(p, f'{tag}_front.png', azim=0, elev=8)
    render(p, f'{tag}_three_quarter.png', azim=38, elev=16)
