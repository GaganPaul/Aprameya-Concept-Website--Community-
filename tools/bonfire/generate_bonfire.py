#!/usr/bin/env python3
"""
Aprameya bonfire v2 - procedural generator (pure numpy/scipy, no Blender needed).
Builds a modular dark-fantasy bonfire (sword, charred logs, stone shards, bones,
flame silhouette, base) and writes a self-contained binary glTF 2.0 (.glb).

Usage:  python3 generate_bonfire.py [out.glb]
Units: 1 unit = 1 metre-ish. +Y up, front of the composition faces +Z, origin = ground centre.
"""
import json, math, struct, sys
import numpy as np
from scipy.spatial import ConvexHull, HalfspaceIntersection

SEED = 20261025
RNG = np.random.default_rng(SEED)

# ----------------------------------------------------------------------------- math
def rot_x(a): c, s = math.cos(a), math.sin(a); return np.array([[1,0,0],[0,c,-s],[0,s,c]])
def rot_y(a): c, s = math.cos(a), math.sin(a); return np.array([[c,0,s],[0,1,0],[-s,0,c]])
def rot_z(a): c, s = math.cos(a), math.sin(a); return np.array([[c,-s,0],[s,c,0],[0,0,1]])
D2R = math.pi / 180.0

def align_y_to(d, roll=0.0):
    d = np.asarray(d, float); d = d / np.linalg.norm(d)
    y = np.array([0, 1.0, 0]); c = float(y @ d)
    if c > 0.999999: R = np.eye(3)
    elif c < -0.999999: R = rot_x(math.pi)
    else:
        v = np.cross(y, d); s2 = float(v @ v)
        vx = np.array([[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]])
        R = np.eye(3) + vx + vx @ vx * ((1 - c) / s2)
    return R @ rot_y(roll)

def mat_to_quat(R):
    t = np.trace(R)
    if t > 0:
        s = math.sqrt(t + 1) * 2; q = [(R[2,1]-R[1,2])/s, (R[0,2]-R[2,0])/s, (R[1,0]-R[0,1])/s, 0.25*s]
    elif R[0,0] > R[1,1] and R[0,0] > R[2,2]:
        s = math.sqrt(1+R[0,0]-R[1,1]-R[2,2])*2; q = [0.25*s, (R[0,1]+R[1,0])/s, (R[0,2]+R[2,0])/s, (R[2,1]-R[1,2])/s]
    elif R[1,1] > R[2,2]:
        s = math.sqrt(1+R[1,1]-R[0,0]-R[2,2])*2; q = [(R[0,1]+R[1,0])/s, 0.25*s, (R[1,2]+R[2,1])/s, (R[0,2]-R[2,0])/s]
    else:
        s = math.sqrt(1+R[2,2]-R[0,0]-R[1,1])*2; q = [(R[0,2]+R[2,0])/s, (R[1,2]+R[2,1])/s, 0.25*s, (R[1,0]-R[0,1])/s]
    q = np.array(q); return (q / np.linalg.norm(q)).tolist()

def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)

_NOISE = {}
def noise3(p, seed=0, f=1.0):
    """Smooth value noise in [0,1]; p is (...,3)."""
    if seed not in _NOISE: _NOISE[seed] = np.random.default_rng(1000 + seed).random((16, 16, 16))
    G = _NOISE[seed]; q = np.asarray(p, float) * f
    i = np.floor(q).astype(int); fr = q - i; fr = fr * fr * (3 - 2 * fr)
    g = lambda dx, dy, dz: G[(i[...,0]+dx) % 16, (i[...,1]+dy) % 16, (i[...,2]+dz) % 16]
    x, y, z = fr[...,0], fr[...,1], fr[...,2]
    c00 = g(0,0,0)*(1-x)+g(1,0,0)*x; c10 = g(0,1,0)*(1-x)+g(1,1,0)*x
    c01 = g(0,0,1)*(1-x)+g(1,0,1)*x; c11 = g(0,1,1)*(1-x)+g(1,1,1)*x
    return (c00*(1-y)+c10*y)*(1-z) + (c01*(1-y)+c11*y)*z

# ----------------------------------------------------------------------------- mesh helpers
def signed_volume(V, F):
    a, b, c = V[F[:,0]], V[F[:,1]], V[F[:,2]]
    return float(np.einsum('ij,ij->i', a, np.cross(b, c)).sum() / 6.0)

def fix_orientation(V, F):
    if signed_volume(V, F) < 0: F = F[:, ::-1].copy()
    return V, F

def vert_normals(V, F):
    n = np.zeros_like(V); fn = np.cross(V[F[:,1]]-V[F[:,0]], V[F[:,2]]-V[F[:,0]])
    for i in range(3): np.add.at(n, F[:,i], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)

def merge(parts):
    Vs, Fs, off = [], [], 0
    for V, F in parts: Vs.append(V); Fs.append(F + off); off += len(V)
    return np.vstack(Vs), np.vstack(Fs)

def ring_mesh(rings, start='fan', end='fan', wrap=False, start_pt=None, end_pt=None):
    """rings: (K,M,3). Caps get their own duplicated ring so the cap edge stays crisp."""
    K, M, _ = rings.shape; V = [rings.reshape(-1, 3)]; F = []
    for k in range(K - 1 + (1 if wrap else 0)):
        k2 = (k + 1) % K
        for j in range(M):
            j2 = (j + 1) % M
            a, b, c, d = k*M+j, k*M+j2, k2*M+j, k2*M+j2
            F += [(a, c, b), (b, c, d)]
    F = [np.array(F, int)]; n = K * M
    def cap(ring, pt):
        nonlocal n
        base = n; V.append(ring); n += M
        p = ring.mean(0) if pt is None else np.asarray(pt, float); V.append(p[None]); ci = n; n += 1
        F.append(np.array([(base + j, base + (j+1) % M, ci) for j in range(M)], int))
    if not wrap:
        if start == 'fan': cap(rings[0], start_pt)
        if end == 'fan': cap(rings[-1], end_pt)
    V = np.vstack(V); F = np.vstack(F)
    return fix_orientation(V, F)

def hull_mesh(points, bevel=0.0):
    """Convex polyhedron (flat faces) with optional chamfer bevel. Returns V, F (outward winding)."""
    pts = np.asarray(points, float); h = ConvexHull(pts)
    if bevel > 0:
        eq = np.unique(np.round(h.equations, 6), axis=0); c = pts.mean(0)
        inside = -(eq[:, :3] @ c + eq[:, 3]); b = min(bevel, 0.4 * inside.min())
        eq2 = eq.copy(); eq2[:, 3] += b
        inner = np.unique(np.round(HalfspaceIntersection(eq2, c).intersections, 7), axis=0)
        dirs = [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)] + [(sx,sy,sz) for sx in (-1,1) for sy in (-1,1) for sz in (-1,1)]
        dirs = np.array(dirs, float); dirs /= np.linalg.norm(dirs, axis=1, keepdims=True)
        pts = (inner[:, None, :] + b * dirs[None]).reshape(-1, 3); h = ConvexHull(pts)
    F = h.simplices.copy(); N = h.equations[:, :3]
    cr = np.cross(pts[F[:,1]]-pts[F[:,0]], pts[F[:,2]]-pts[F[:,0]])
    flip = np.einsum('ij,ij->i', cr, N) < 0; F[flip] = F[flip][:, ::-1]
    used = np.unique(F); remap = -np.ones(len(pts), int); remap[used] = np.arange(len(used))
    return pts[used], remap[F]

def hull_equations(V):
    return ConvexHull(V).equations

def uv_sphere(center, radius, nu=10, nv=7, scale=(1, 1, 1)):
    rings = []
    for k in range(1, nv):
        phi = math.pi * k / nv; r = math.sin(phi); y = math.cos(phi)
        rings.append([[r*math.cos(2*math.pi*j/nu), y, r*math.sin(2*math.pi*j/nu)] for j in range(nu)])
    rings = np.array(rings) * np.array(scale) * radius + np.asarray(center)
    return ring_mesh(rings, start='fan', end='fan',
                     start_pt=np.asarray(center) + np.array([0, radius*scale[1], 0]),
                     end_pt=np.asarray(center) - np.array([0, radius*scale[1], 0]))

def srgb2lin(c): return np.power(np.clip(c, 0, 1), 2.2)

# ----------------------------------------------------------------------------- materials (sRGB inputs)
MATERIALS = {
    # base = brightest colour used by vertex colours of the material (fallback look without COLOR_0)
    'CharredWood':   dict(base=(0.30, 0.28, 0.26), metal=0.0,  rough=0.92),
    'AgedSteel':     dict(base=(0.58, 0.58, 0.59), metal=0.90, rough=0.42),
    'DarkIron':      dict(base=(0.20, 0.20, 0.22), metal=0.75, rough=0.55),
    'WornLeather':   dict(base=(0.20, 0.13, 0.09), metal=0.0,  rough=0.85),
    'VolcanicStone': dict(base=(0.36, 0.35, 0.36), metal=0.04, rough=0.78),
    'ObsidianShard': dict(base=(0.14, 0.14, 0.17), metal=0.12, rough=0.30),
    'AshStone':      dict(base=(0.40, 0.39, 0.38), metal=0.02, rough=0.88),
    'WeatheredBone': dict(base=(0.78, 0.72, 0.60), metal=0.0,  rough=0.72),
    'BasaltBase':    dict(base=(0.30, 0.29, 0.28), metal=0.02, rough=0.90),
    'AshBed':        dict(base=(0.30, 0.28, 0.26), metal=0.0,  rough=1.00),
    'EmberCore':     dict(base=(0.20, 0.07, 0.04), metal=0.0,  rough=0.80, emissive=(0.55, 0.14, 0.03)),
}

PARTS = []  # each: dict(name, group, V, F, shade, col, mat, t, R, ftint)
def add_part(name, group, V, F, mat, col, shade='flat', t=(0, 0, 0), R=None, ftint=0.0):
    PARTS.append(dict(name=name, group=group, V=np.asarray(V, float), F=np.asarray(F, int), shade=shade,
                      col=np.asarray(col, float), mat=mat, t=np.asarray(t, float),
                      R=np.eye(3) if R is None else np.asarray(R, float), ftint=ftint))

def world_pts(part):
    return part['V'] @ part['R'].T + part['t']

# ----------------------------------------------------------------------------- SWORD
SWORD_T = np.array([0.30, 1.78, 0.0]); SWORD_R = rot_z(-10 * D2R)
BLADE_L = 1.50

def make_blade():
    P = np.array([(-0.985, 0.14), (-0.60, 1.0), (-0.16, 0.6), (0.16, 0.6), (0.60, 1.0), (0.985, 0.14),
                  (0.985, -0.14), (0.60, -1.0), (0.16, -0.6), (-0.16, -0.6), (-0.60, -1.0), (-0.985, -0.14)])
    fuller_idx = [2, 3, 8, 9]; edge_idx = [0, 5, 6, 11]
    s = np.concatenate([np.linspace(0, 0.76, 22), np.linspace(0.78, 0.985, 12)])
    rg = np.random.default_rng(11)
    nickL = rg.uniform(0, 1, len(s)); nickR = rg.uniform(0, 1, len(s))
    rings = np.zeros((len(s), 12, 3)); cols = np.zeros((len(s), 12, 3))
    for i, si in enumerate(s):
        u = max(0.0, (si - 0.76) / 0.24)
        wb = 0.052 * (1 - 0.34 * si); thb = 0.0145 * (1 - 0.30 * si)
        w = wb * (1 - u ** 1.6) ** 0.62; th = thb * (1 - 0.85 * u ** 1.5)
        wl = w * (1 - (0.05 * nickL[i] if si > 0.1 else 0) - (0.14 if i in (9, 10, 17) else 0))   # worn edge nicks
        wr = w * (1 - (0.05 * nickR[i] if si > 0.1 else 0) - (0.12 if i in (13, 19) else 0))
        fz = 0.6 + 0.4 * float(smooth(0.62, 0.9, si)) + (0.4 * (1 - float(smooth(0.0, 0.07, si))))
        fz = min(fz, 1.0)
        for j, (px, pz) in enumerate(P):
            x = px * (wl if px < 0 else wr); z = pz * th * (fz / 0.6 * 0.6 if j in fuller_idx else 1.0) if j in fuller_idx else pz * th
            if j in fuller_idx: z = np.sign(pz) * 1.0 * th * min(abs(pz) / 0.6 * fz, 1.0) if False else np.sign(pz) * th * fz
            rings[i, j] = (x, -si * BLADE_L, z)
            steel = 1.0
            edge = 1.0 if j in edge_idx else 0.78
            if j in fuller_idx: edge = 0.52
            n = float(noise3(np.array([x * 25, si * 6, z * 25]), 5))
            scr = float(noise3(np.array([x * 60, si * 3.0, z * 60]), 6))
            steel = (0.50 + 0.55 * n) * edge * (1.18 if scr > 0.78 else 1.0) * (0.78 + 0.22 * (1 - si))
            cols[i, j] = np.array([0.52, 0.52, 0.53]) * min(steel, 1.12)
    tip = np.array([0.0, -BLADE_L * 1.0, 0.0])
    V, F = ring_mesh(rings, start='fan', end='fan', end_pt=tip)
    C = np.vstack([cols.reshape(-1, 3), np.tile(cols[0].mean(0), (13, 1)), np.tile(cols[-1].mean(0), (13, 1))])
    return V, F, C

def make_crossguard():
    parts = []
    def box(cx, cy, cz, hx, hy, hz): return [(cx+sx*hx, cy+sy*hy, cz+sz*hz) for sx in (-1,1) for sy in (-1,1) for sz in (-1,1)]
    parts.append(hull_mesh(box(0, 0, 0, 0.050, 0.034, 0.030), 0.005))
    for sgn in (-1, 1):
        pts = []
        for x, y0, y1, hz in [(0.040, -0.030, 0.034, 0.028), (0.150, -0.046, 0.016, 0.022), (0.245, -0.082, -0.036, 0.016)]:
            pts += [(sgn*x, y, z) for y in (y0, y1) for z in (-hz, hz)]
        pts.append((sgn*0.292, -0.074, 0.0))
        parts.append(hull_mesh(pts, 0.004))
    V, F = merge(parts)
    n = noise3(V * 18, 7)
    C = np.array([0.20, 0.20, 0.22]) * (0.6 + 0.6 * n)[:, None]
    return V, F, C

def make_grip():
    y0, y1 = 0.030, 0.300; K = 40; M = 14
    t = np.linspace(0, 1, K); y = y0 + (y1 - y0) * t
    r = 0.0185 * (1 + 0.10 * np.sin(math.pi * t)) * (1 + 0.075 * np.cos(2 * math.pi * 9 * t))   # cord wrap bands
    th = np.linspace(0, 2 * math.pi, M, endpoint=False)
    rings = np.stack([np.stack([r[k] * np.cos(th), np.full(M, y[k]), r[k] * np.sin(th)], 1) for k in range(K)])
    V, F = ring_mesh(rings)
    band = 0.5 + 0.5 * np.cos(2 * math.pi * 9 * np.clip((V[:, 1] - y0) / (y1 - y0), 0, 1))
    n = noise3(V * 40, 8)
    C = np.array([0.20, 0.13, 0.09])[None] * (0.45 + 0.4 * band + 0.25 * n)[:, None]
    return V, F, C

def make_pommel_nut():
    prof = [(0.016, 0.296), (0.030, 0.304), (0.034, 0.322), (0.031, 0.338), (0.020, 0.352), (0.013, 0.356)]
    M = 12; th = np.linspace(0, 2 * math.pi, M, endpoint=False)
    rings = np.stack([np.stack([r * np.cos(th), np.full(M, y), r * np.sin(th)], 1) for r, y in prof])
    V, F = ring_mesh(rings)
    C = np.array([0.20, 0.20, 0.22])[None] * (0.55 + 0.5 * noise3(V * 30, 9))[:, None]
    return V, F, C

def make_pommel_ring():
    R0, r0 = 0.050, 0.0125; cy = 0.356 + R0 - 0.006; Ku, Mv = 26, 8
    rings = []
    for k in range(Ku):
        u = 2 * math.pi * k / Ku
        ring = []
        for j in range(Mv):
            v = 2 * math.pi * j / Mv
            rr = R0 + r0 * math.cos(v)
            ring.append((rr * math.sin(u) * 1.0, cy - rr * math.cos(u) + 0.0, r0 * math.sin(v)))   # ring lies in the XY plane (faces the viewer)
        rings.append(ring)
    V, F = ring_mesh(np.array(rings), wrap=True)
    C = np.array([0.20, 0.20, 0.22])[None] * (0.55 + 0.5 * noise3(V * 30, 10))[:, None]
    return V, F, C

# ----------------------------------------------------------------------------- LOGS / BONES
def make_log(L, r, seed):
    rg = np.random.default_rng(seed); M = 28
    ts = np.concatenate([[0, 0.015, 0.05], np.linspace(0.10, 0.90, 13), [0.95, 0.985, 1.0]]); K = len(ts)
    th = np.linspace(0, 2 * math.pi, M, endpoint=False)
    cracks = [(rg.uniform(0, 2 * math.pi), rg.uniform(0.08, 0.5), rg.uniform(0.28, 0.48), rg.uniform(0.2, 0.36)) for _ in range(4)]
    end_f = np.ones(K); end_f[0], end_f[1], end_f[-1], end_f[-2] = 0.50, 0.86, 0.38, 0.80
    bend = rg.uniform(-1, 1, 2) * 0.018; ph = rg.uniform(0, 6.28)
    rings = np.zeros((K, M, 3)); depth = np.zeros((K, M))
    for k, t in enumerate(ts):
        cx = bend[0] * math.sin(math.pi * t) * 1.0; cz = bend[1] * math.sin(math.pi * t)
        for j, a in enumerate(th):
            n = float(noise3(np.array([math.cos(a) * 1.3, math.sin(a) * 1.3, t * L * 3.5]), seed % 7 + 1))
            rad = r * (1 + 0.16 * (n - 0.5)) * (1 - 0.10 * t) * (1 + 0.05 * math.cos(6 * a + ph + 3 * t))
            d = 0.0
            for (ca, t0, t1, dp) in cracks:
                da = (a - ca + math.pi) % (2 * math.pi) - math.pi
                d += dp * 1.25 * math.exp(-(da / 0.30) ** 2) * float(smooth(t0, t0 + 0.08, t) * (1 - smooth(t1 - 0.08, t1, t)))
            d = min(d, 0.5); depth[k, j] = d
            rad *= (1 - d) * end_f[k]
            yy = t * L
            if k in (0, K - 1): yy += rg.uniform(-0.05, 0.05)          # splintered burnt ends
            if k in (1, K - 2): yy += rg.uniform(-0.008, 0.008)
            rings[k, j] = (cx + rad * math.cos(a), yy, cz + rad * math.sin(a))
    V, F = ring_mesh(rings, start_pt=rings[0].mean(0) + [0, -0.02, 0], end_pt=rings[-1].mean(0) + [0, 0.09, 0])
    nmain = K * M
    # colours: charred black with brown & ash patches; brown glow in crack bottoms
    n1 = noise3(V * 9, 2); n2 = noise3(V * 22, 3)
    base = np.array([0.055, 0.046, 0.042])
    C = np.tile(base, (len(V), 1))
    C = C * (0.55 + 1.0 * n1)[:, None]
    brown = (n1 > 0.58)[:, None] * np.array([0.11, 0.07, 0.048]) * (n2[:, None] + 0.4)
    ash = (n2 > 0.74)[:, None] * np.array([0.20, 0.19, 0.18]) * ((n2[:, None] - 0.7) * 2.5)
    C = C + brown + ash
    dflat = np.zeros(len(V)); dflat[:nmain] = depth.reshape(-1)
    C = C + (dflat > 0.12)[:, None] * np.array([0.16, 0.06, 0.02]) * (dflat[:, None] * 2.0)
    endzone = np.minimum(V[:, 1], L - V[:, 1]) / L
    C = C * (0.5 + 0.5 * smooth(0.0, 0.07, endzone))[:, None] + (endzone < 0.02)[:, None] * 0.01
    return V, F, np.clip(C, 0, 0.30)

def make_bone(L, r, seed):
    rg = np.random.default_rng(seed); K = 18; M = 12
    t = np.linspace(0.04, 0.96, K); y = t * L
    rad = r * (0.92 + 0.12 * np.sin(math.pi * t)) * (1 + 0.55 * np.exp(-((t - 0.04) / 0.10) ** 2) + 0.55 * np.exp(-((0.96 - t) / 0.10) ** 2))
    th = np.linspace(0, 2 * math.pi, M, endpoint=False)
    rings = np.stack([np.stack([rad[k] * np.cos(th) * 1.0, np.full(M, y[k]), rad[k] * np.sin(th) * 0.86], 1) for k in range(K)])
    parts = [ring_mesh(rings)]
    lr = r * 1.18
    for yy, big in ((r * 0.55, 1.0), (L - r * 0.55, rg.uniform(0.9, 1.1))):
        for sgn in (-1, 1):
            parts.append(uv_sphere((sgn * r * 0.95, yy + (-sgn * 0.0) * 0, 0.0), lr * big * rg.uniform(0.92, 1.05), 10, 7, (1, 0.95, 0.90)))
    V, F = merge(parts)
    n1 = noise3(V * 26, 12); n2 = noise3(V * 9, 13)
    ivory = np.array([0.74, 0.69, 0.57]); soot = np.array([0.20, 0.17, 0.14])
    k = np.clip(0.35 + 0.65 * smooth(0.25, 0.75, n2) , 0, 1)[:, None]
    C = soot * (1 - k) + ivory * k
    C = C * (0.82 + 0.28 * n1)[:, None]
    C = C * (1 - 0.22 * (np.abs(V[:, 0]) > r * 1.4))[:, None]
    return V, F, np.clip(C, 0, 0.78)

# ----------------------------------------------------------------------------- SHARDS / STONES / SLABS
def make_shard(h, w, d, seed, colbase):
    rg = np.random.default_rng(seed); j = lambda s: 1 + rg.uniform(-s, s)
    pts = []
    for sx in (-1, 1):
        for sz in (-1, 1): pts.append((sx*0.72*w*j(0.08), 0.0, sz*0.72*d*j(0.1)))
    for sx in (-1, 1):
        for sz in (-1, 1): pts.append((sx*1.0*w*j(0.06), 0.36*h, sz*0.95*d*j(0.1)))
    pts.append((rg.uniform(-0.1, 0.1) * w, 0.44 * h, 1.15 * d)); pts.append((rg.uniform(-0.1, 0.1) * w, 0.44 * h, -1.15 * d))
    for sx in (-1, 1):
        for sz in (-1, 1): pts.append((sx*0.40*w*j(0.1), 0.74*h, sz*0.5*d*j(0.1)))
    ox = rg.uniform(-0.16, 0.16) * w
    pts += [(ox - 0.07*w, h, 0.0), (ox + 0.09*w, h*0.985, 0.0)]
    V, F = hull_mesh(pts, 0.011)
    yn = np.clip(V[:, 1] / h, 0, 1)
    n = noise3(V * 14, 14)
    C = np.asarray(colbase)[None] * (0.55 + 0.45 * smooth(0, 0.6, yn) + 0.16 * (yn > 0.85))[:, None] * (0.75 + 0.5 * n)[:, None]
    return V, F, C

def make_stone(sx, sy, sz, seed, colbase, bevel=0.012):
    rg = np.random.default_rng(seed); pts = []
    for a in (-1, 1):
        for b in (0, 1):
            for c in (-1, 1):
                pts.append((a*sx*rg.uniform(0.75, 1.0), b*sy*rg.uniform(0.82, 1.05), c*sz*rg.uniform(0.75, 1.0)))
    pts += [(0, sy*rg.uniform(1.0, 1.2), 0), (sx*rg.uniform(0.95, 1.1), sy*0.4, 0), (-sx*rg.uniform(0.95, 1.1), sy*0.4, rg.uniform(-.3, .3)*sz),
            (0, sy*0.3, sz*1.05), (0, sy*0.3, -sz*1.05)]
    V, F = hull_mesh(pts, bevel)
    n = noise3(V * 9, 15); n2 = noise3(V * 30, 16)
    C = np.asarray(colbase)[None] * (0.5 + 0.7 * n)[:, None] * (0.85 + 0.3 * n2)[:, None]
    return V, F, C

def make_plate(length, width, thick, skew, colbase, seed):
    pts = []
    for z0, z1 in ((0, 0), ):
        pass
    hl = length / 2
    for y in (0.0, thick):
        pts += [(-hl, y, -width/2), (-hl + skew, y, width/2), (hl, y, width/2), (hl - skew, y, -width/2)]
    V, F = hull_mesh(pts, 0.003)
    C = np.asarray(colbase)[None] * (0.7 + 0.6 * noise3(V * 20, 17))[:, None]
    return V, F, C

# ----------------------------------------------------------------------------- collision helpers
def seg_pts(a, b, n=18): return np.linspace(a, b, n)
def sdf_hull(P, E): return (P @ E[:, :3].T + E[:, 3]).max(axis=1)
def capsule_dist(A, B):
    return float(np.sqrt(((A[:, None, :] - B[None, :, :]) ** 2).sum(-1)).min())

# ----------------------------------------------------------------------------- SCENE LAYOUT
BED_TOP = 0.12
OBST_HULLS = []     # (name, E) world-space hull equations (shards + stones) used by the log/bone placement
LOG_CAPS, BONE_CAPS = [], []
SWORD_A = SWORD_T + SWORD_R @ np.array([0, -BLADE_L, 0]); SWORD_B = SWORD_T + SWORD_R @ np.array([0, 0.0, 0])
SWORD_PTS = seg_pts(SWORD_A, SWORD_B, 40)
SWORD_RADIUS = 0.06

def build_sword():
    for name, (fn, mat) in {'CentralSword_Blade': (make_blade, 'AgedSteel'), 'CentralSword_Crossguard': (make_crossguard, 'DarkIron'),
                            'CentralSword_Grip': (make_grip, 'WornLeather'), 'CentralSword_PommelNut': (make_pommel_nut, 'DarkIron'),
                            'CentralSword_PommelRing': (make_pommel_ring, 'DarkIron')}.items():
        V, F, C = fn()
        shade = 'smooth' if name in ('CentralSword_Grip', 'CentralSword_PommelRing', 'CentralSword_PommelNut') else 'flat'
        add_part(name, 'Sword', V, F, mat, C, shade, ftint=0.03 if shade == 'flat' else 0.0)

SHARDS = [  # x, z, h, w, d, lean(+ = tip toward +x), yaw, material  -- flame cluster kept behind the log pile
    (-0.30, -0.34, 1.74, 0.28, 0.11,  3,   8, 'VolcanicStone'),
    (-0.54, -0.16, 1.30, 0.24, 0.10, -8, -10, 'ObsidianShard'),
    ( 0.12, -0.38, 1.52, 0.26, 0.10,  4,  -6, 'VolcanicStone'),
    (-0.14, -0.20, 1.10, 0.20, 0.09, -3,  12, 'ObsidianShard'),
    ( 0.66, -0.14, 1.10, 0.22, 0.09,  9,  -8, 'VolcanicStone'),
    (-0.88,  0.06, 0.82, 0.20, 0.09,-12,   6, 'VolcanicStone'),
    ( 0.94,  0.04, 0.74, 0.20, 0.08, 14,  -5, 'ObsidianShard'),
    (-0.68, -0.02, 0.62, 0.17, 0.08, -6,  10, 'VolcanicStone'),
    ( 0.80, -0.04, 0.64, 0.17, 0.08,  6,  -9, 'ObsidianShard'),
    ( 0.24, -0.20, 0.96, 0.20, 0.08,  0,   5, 'VolcanicStone'),
    (-0.74, -0.36, 1.04, 0.20, 0.08, -3, -14, 'ObsidianShard'),
    ( 0.52, -0.36, 1.20, 0.22, 0.08,  6,  -4, 'VolcanicStone'),
]
SHARD_COL = {'VolcanicStone': (0.22, 0.21, 0.22), 'ObsidianShard': (0.09, 0.09, 0.115)}

def build_shards():
    for i, (x, z, h, w, d, lean, yaw, mat) in enumerate(SHARDS, 1):
        V, F, C = make_shard(h, w, d, 100 + i, SHARD_COL[mat])
        R = rot_y(yaw * D2R) @ rot_z(-lean * D2R); t = np.array([x, BED_TOP - 0.015, z])
        add_part(f'StoneShard_{i:02d}', 'StoneShards', V, F, mat, C, 'flat', t, R, ftint=0.10)
        Vw = V @ R.T + t; OBST_HULLS.append((f'StoneShard_{i:02d}', hull_equations(Vw)))

def build_base():
    rg = np.random.default_rng(31)
    # ash bed
    n = 18; pts = []
    for k in range(n):
        a = 2 * math.pi * k / n
        pts.append((0.97 * rg.uniform(0.9, 1.05) * math.cos(a), 0.0, 0.97 * rg.uniform(0.9, 1.05) * math.sin(a)))
        pts.append((0.80 * rg.uniform(0.9, 1.05) * math.cos(a), BED_TOP + rg.uniform(-0.01, 0.012), 0.80 * rg.uniform(0.9, 1.05) * math.sin(a)))
    pts.append((0, BED_TOP + 0.02, 0))
    V, F = hull_mesh(pts, 0.012)
    nn = noise3(V * 7, 20); n2 = noise3(V * 28, 21)
    C = np.array([0.26, 0.245, 0.23])[None] * (0.45 + 0.65 * nn)[:, None] * (0.8 + 0.3 * n2)[:, None]
    add_part('Bonfire_Base_AshBed', 'Base', V, F, 'AshBed', C, 'flat', ftint=0.07)
    # outer stone ring
    k = 0
    for ia in range(16):
        a = (ia * 22.5 + rg.uniform(-5, 5)) * D2R
        front = math.sin(a) > 0.55
        R_ = rg.uniform(1.00, 1.12) if not front else rg.uniform(1.18, 1.26)
        sx, sy, sz = rg.uniform(0.17, 0.27), (rg.uniform(0.07, 0.10) if front else rg.uniform(0.12, 0.19)), rg.uniform(0.13, 0.2)
        k += 1
        V, F, C = make_stone(sx, sy, sz, 200 + k, (0.27, 0.26, 0.26))
        Rm = rot_y(-a + math.pi / 2 + rg.uniform(-0.3, 0.3)); t = np.array([R_ * math.cos(a), -0.012, R_ * math.sin(a)])
        add_part(f'Bonfire_Base_Stone_{k:02d}', 'Base', V, F, 'BasaltBase', C, 'flat', t, Rm, ftint=0.12)
        OBST_HULLS.append((f'stone{k}', hull_equations(V @ Rm.T + t)))
    # second layer stones, back & sides
    for ia in range(5):
        a = (200 + ia * 34 + rg.uniform(-6, 6)) * D2R; R_ = rg.uniform(0.98, 1.08)
        k += 1; V, F, C = make_stone(rg.uniform(0.12, 0.18), rg.uniform(0.09, 0.13), rg.uniform(0.1, 0.15), 200 + k, (0.27, 0.26, 0.26))
        Rm = rot_y(rg.uniform(0, 6.28)); t = np.array([R_ * math.cos(a), 0.12 + rg.uniform(0, 0.04), R_ * math.sin(a)])
        add_part(f'Bonfire_Base_Stone_{k:02d}', 'Base', V, F, 'BasaltBase', C, 'flat', t, Rm, ftint=0.12)
        OBST_HULLS.append((f'stone{k}', hull_equations(V @ Rm.T + t)))
    # ritual ground plates (angular lines echoing the reference), front side
    plates = [(0.85, 0.035, 0.12, 0.00, 1.09, -8), (0.60, 0.03, 0.15, 0.30, 1.22, 12), (0.45, 0.03, 0.12, -0.55, 1.18, -22),
              (0.50, 0.028, 0.10, 0.62, 1.04, 28), (0.38, 0.025, 0.10, -0.20, 1.28, 35), (0.55, 0.03, 0.14, -0.80, 0.95, 70)]
    for i, (L_, w_, sk, x, z, yaw) in enumerate(plates, 1):
        V, F, C = make_plate(L_, w_, 0.014, sk, (0.19, 0.19, 0.21), 300 + i)
        add_part(f'Bonfire_Base_GroundPlate_{i:02d}', 'Base', V, F, 'DarkIron', C, 'flat', (x, 0.0, z), rot_y(yaw * D2R), ftint=0.05)

BONE_TARGETS = [  # outer end (x,z) -> inner end (x,z); y set by resting on bed
    ((-0.90, 0.92), (0.30, 0.76)),
    (( 0.92, 0.88), (-0.32, 0.74)),
    ((-0.46, 1.04), (0.46, 1.02)),
    ((-1.00, 0.46), (-0.40, 0.70)),
    (( 1.00, 0.42), (0.40, 0.68)),
]
def build_bones():
    rg = np.random.default_rng(41)
    for i, (A, B) in enumerate(BONE_TARGETS, 1):
        best = None
        for attempt in range(400):
            jit = 0.07 * (1 + attempt / 200)
            a = np.array([A[0] + rg.uniform(-jit, jit), 0.12 + 0.05 + rg.uniform(0, 0.02), A[1] + rg.uniform(-jit, jit)])
            b = np.array([B[0] + rg.uniform(-jit, jit), 0.12 + 0.05 + (rg.uniform(0.10, 0.17) if i == 2 else rg.uniform(0.0, 0.05)), B[1] + rg.uniform(-jit, jit)])   # bone 2 rides over bone 1 where they cross
            L = np.linalg.norm(b - a)
            if not (0.66 <= L <= 1.06): continue
            P = seg_pts(a, b, 22); ok = True
            for nm, E in OBST_HULLS:
                if sdf_hull(P, E).min() < 0.052: ok = False; break
            if ok and capsule_dist(P, SWORD_PTS) < 0.11: ok = False
            if ok:
                for (a2, b2, r2) in BONE_CAPS:
                    if capsule_dist(P, seg_pts(a2, b2, 22)) < 0.078: ok = False; break
            if ok: best = (a, b); break
        if best is None: print('  ! bone', i, 'no clean placement'); continue
        a, b = best; L = float(np.linalg.norm(b - a)); r = 0.030 + 0.003 * (i % 3)
        R0 = align_y_to(b - a); rho = math.atan2(R0[1, 0], R0[1, 2]) + rg.uniform(-0.25, 0.25)
        R = align_y_to(b - a, rho)
        V, F, C = make_bone(L, r, 400 + i)
        add_part(f'BoneElement_{i:02d}', 'BoneElements', V, F, 'WeatheredBone', C, 'smooth', a, R)
        BONE_CAPS.append((a, b, 0.05))

def build_logs(n_logs=12):
    rg = np.random.default_rng(51); placed = 0; phis = []
    for i in range(1, n_logs + 1):
        r = rg.uniform(0.060, 0.082); cands = []; tier2 = i > 6
        for attempt in range(4000):
            phi = rg.uniform(-25, 205) * D2R
            if any(abs(((phi - p) + math.pi) % (2*math.pi) - math.pi) < (7 if tier2 else 14) * D2R for p in phis): continue
            front = math.sin(phi) > 0.45
            Ro = rg.uniform(0.56, 0.68) if front else rg.uniform(0.66, 0.95); Ri = rg.uniform(0.10, 0.34) if front else rg.uniform(0.2, 0.5); phi_i = phi + rg.uniform(-22, 22) * D2R
            yo = BED_TOP + r * 0.95; yi = yo + rg.uniform(0.30 if tier2 else 0.12, 0.50 if tier2 else (0.30 if front else 0.55))
            a = np.array([Ro * math.cos(phi), yo, Ro * math.sin(phi)]); b = np.array([Ri * math.cos(phi_i), yi, Ri * math.sin(phi_i)])
            L = np.linalg.norm(b - a)
            dh = math.hypot(a[0] - b[0], a[2] - b[2])
            if not (0.52 <= L <= 1.15) or dh < 0.32 or (b[1] - a[1]) / dh > 1.0: continue
            P = seg_pts(a, b, 24)
            if capsule_dist(P, SWORD_PTS) < r + SWORD_RADIUS + 0.004: continue
            if any(sdf_hull(P, E).min() < r - 0.02 for nm, E in OBST_HULLS): continue
            if any(capsule_dist(P, seg_pts(a2, b2, 22)) < r + r2 - 0.02 for a2, b2, r2 in LOG_CAPS + BONE_CAPS): continue
            contacts = sum(capsule_dist(P[8:], seg_pts(a2, b2, 22)) < r + r2 + 0.04 for a2, b2, r2 in LOG_CAPS)
            contacts += sum(sdf_hull(P[10:], E).min() < r + 0.04 for nm, E in OBST_HULLS)
            cands.append((contacts + rg.uniform(0, 0.9), a, b, phi))
            if len(cands) >= 40: break
        if not cands: print('  ! log', i, 'no clean placement'); continue
        cands.sort(key=lambda c: -c[0]); _, a, b, phi = cands[0]; phis.append(phi)
        L = float(np.linalg.norm(b - a)); R0 = align_y_to(b - a)
        R = align_y_to(b - a, rg.uniform(0, 6.28)); V, F, C = make_log(L, r, 500 + i)
        placed += 1
        add_part(f'CharredLog_{placed:02d}', 'CharredLogs', V, F, 'CharredWood', C, 'smooth', a, R)
        LOG_CAPS.append((a, b, r))
    return placed

def build_ember_and_debris():
    rg = np.random.default_rng(61)
    for i, (x, z, s) in enumerate([(-0.10, 0.04, 0.05), (0.07, 0.10, 0.04), (-0.02, -0.06, 0.045)], 1):
        V, F = hull_mesh([(rg.uniform(-s, s), rg.uniform(0, 0.5*s), rg.uniform(-s, s)) for _ in range(9)] + [(0, s*1.6, 0)], 0.004)
        C = np.tile(np.array([0.30, 0.10, 0.05]), (len(V), 1)) * (0.6 + 0.6 * noise3(V * 30, 22))[:, None]
        add_part(f'EmberCore_{i:02d}', 'EmberCore', V, F, 'EmberCore', C, 'flat', (x, BED_TOP - 0.01, z), rot_y(rg.uniform(0, 6)), 0.05)
    k = 0
    for attempt in range(400):
        if k >= 22: break
        a = rg.uniform(0, 2 * math.pi); R_ = rg.uniform(0.2, 0.86)
        p = np.array([R_ * math.cos(a), BED_TOP - 0.005, R_ * math.sin(a)])
        if math.sin(a) < -0.3: continue
        s = rg.uniform(0.022, 0.05)
        if any(capsule_dist(p[None], seg_pts(a2, b2, 20)) < r2 + s * 0.6 for a2, b2, r2 in LOG_CAPS + BONE_CAPS): continue
        if any(sdf_hull(p[None], E).min() < s * 0.8 for nm, E in OBST_HULLS): continue
        if capsule_dist(p[None], SWORD_PTS) < 0.08: continue
        k += 1
        V, F, C = make_stone(s, s * 0.6, s * 0.8, 600 + k, (0.20, 0.19, 0.18), 0.004)
        add_part(f'Bonfire_Base_Debris_{k:02d}', 'Base', V, F, 'AshBed', C, 'flat', p, rot_y(rg.uniform(0, 6.28)), 0.1)

# ----------------------------------------------------------------------------- SILHOUETTE BLADES
def catmull(pts, n):
    pts = np.asarray(pts, float); P = np.vstack([pts[0] * 2 - pts[1], pts, pts[-1] * 2 - pts[-2]]); out = []
    seg = len(pts) - 1
    for i in range(n):
        u = i / (n - 1) * seg; k = min(int(u), seg - 1); t = u - k
        p0, p1, p2, p3 = P[k], P[k+1], P[k+2], P[k+3]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2*p0 - 5*p1 + 4*p2 - p3) * t * t + (-p0 + 3*p1 - 3*p2 + p3) * t ** 3))
    return np.array(out)

def make_flame_blade(ctrl, zoff, wmax, peak, th0, seed):
    rg = np.random.default_rng(seed); N = 46
    C3 = catmull(ctrl, N); s = np.linspace(0, 1, N)
    T = np.gradient(C3[:, :2], axis=0); T /= np.linalg.norm(T, axis=1, keepdims=True)
    Nrm = np.stack([-T[:, 1], T[:, 0]], 1)
    prof = np.array([(-1, 0), (-0.45, 0.75), (0.45, 0.75), (1, 0), (0.45, -0.75), (-0.45, -0.75)])
    rings = np.zeros((N, 6, 3)); cols = np.zeros((N, 6, 3))
    for i in range(1, N - 1):
        wv = wmax * (math.sin(math.pi * min(1, s[i] ** (0.75) / 1.0)) ** 0.9) * (0.55 + 0.45 * math.sin(math.pi * min(1, s[i] / peak * 0.5 + 0.0)) if s[i] < peak else 1.0)
        wv = wmax * (math.sin(math.pi * s[i]) ** 0.8) * (0.8 + 0.3 * math.cos(math.pi * (s[i] - peak)))
        jag = 1 + 0.10 * (rg.uniform(-1, 1)) * (1 if (i % 4 == 0) else 0.2)
        tz = th0 * (0.5 + 0.5 * math.sin(math.pi * s[i]))
        zc = zoff + 0.12 * s[i]
        for j, (px, pz) in enumerate(prof):
            side = px * wv * (jag if px > 0 else (1 + 0.06 * rg.uniform(-1, 1)))
            x, y = C3[i] + Nrm[i] * side
            rings[i, j] = (x, y, zc + pz * tz)
            n = float(noise3(np.array([x * 6, y * 6, 0.0]), 23))
            cols[i, j] = np.array([0.37, 0.36, 0.35]) * (0.50 + 0.5 * n) * (0.55 + 0.45 * smooth(0, 0.55, s[i])) * (1.12 if abs(px) == 1 else 1.0)
    for e in (0, N - 1):
        rings[e] = np.array([C3[e][0], C3[e][1], zoff + 0.12 * s[e]]); cols[e] = np.array([0.4, 0.38, 0.36])
    V, F = ring_mesh(rings, start='fan', end='fan')
    Cc = np.vstack([cols.reshape(-1, 3), np.tile(cols[0].mean(0), (7, 1)), np.tile(cols[-1].mean(0), (7, 1))])
    return V, F, Cc

def build_silhouette():
    left = [(-0.98, 0.10), (-1.12, 0.65), (-1.06, 1.25), (-0.86, 1.85), (-0.52, 2.46)]
    right = [(1.02, 0.10), (1.14, 0.60), (1.05, 1.15), (0.88, 1.70), (0.66, 2.22)]
    for name, ctrl, zoff, wmax, peak, th0, seed in (('FlameSilhouette_Left', left, -0.14, 0.092, 0.42, 0.048, 70),
                                                    ('FlameSilhouette_Right', right, -0.10, 0.080, 0.36, 0.045, 71)):
        V, F, C = make_flame_blade(ctrl, zoff, wmax, peak, th0, seed)
        add_part(name, 'Silhouette', V, F, 'AshStone', C, 'flat', ftint=0.07)

# ----------------------------------------------------------------------------- EXPORT (glTF 2.0 binary)
GROUP_ORDER = ['Sword', 'CharredLogs', 'StoneShards', 'BoneElements', 'Silhouette', 'Base', 'EmberCore']
FIRE_ANCHOR = (0.0, 0.34, 0.04)

def expand(part):
    V, F, C = part['V'], part['F'], part['col']
    if part['shade'] == 'flat':
        a, b, c = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
        cr = np.cross(b - a, c - a); area = np.linalg.norm(cr, axis=1)
        keep = area > 1e-10; F = F[keep]; cr = cr[keep]; area = area[keep]
        fn = cr / area[:, None]
        P = V[F].reshape(-1, 3); N = np.repeat(fn, 3, axis=0)
        Cf = C[F]                                           # (m,3,3)
        rg = np.random.default_rng(len(F)); tint = 1 + part['ftint'] * rg.standard_normal(len(F))
        Cc = (Cf * tint[:, None, None]).reshape(-1, 3)
        idx = np.arange(len(P)).reshape(-1, 3)
    else:
        keep = np.linalg.norm(np.cross(V[F[:,1]]-V[F[:,0]], V[F[:,2]]-V[F[:,0]]), axis=1) > 1e-12
        F = F[keep]; P = V; N = vert_normals(V, F); Cc = C; idx = F
    base = srgb2lin(np.array(MATERIALS[part['mat']]['base']))
    mult = np.clip(srgb2lin(np.clip(Cc, 0, 1)) / base[None], 0, 1)
    rgba = np.concatenate([mult, np.ones((len(mult), 1))], 1)
    return P.astype(np.float32), N.astype(np.float32), (rgba * 255 + 0.5).astype(np.uint8), idx.astype(np.int64)

def write_glb(path):
    buf = bytearray(); views, accs = [], []
    def add_view(arr, target):
        while len(buf) % 4: buf.append(0)
        views.append(dict(buffer=0, byteOffset=len(buf), byteLength=arr.nbytes, target=target)); buf.extend(arr.tobytes()); return len(views) - 1
    mat_names = list(MATERIALS); mats = []
    for nm in mat_names:
        m = MATERIALS[nm]; bc = srgb2lin(np.array(m['base'])).tolist() + [1.0]
        d = dict(name=nm, pbrMetallicRoughness=dict(baseColorFactor=[round(x, 5) for x in bc], metallicFactor=m['metal'], roughnessFactor=m['rough']), doubleSided=False)
        if 'emissive' in m: d['emissiveFactor'] = [round(float(x), 4) for x in srgb2lin(np.array(m['emissive'])) * 0.9]
        mats.append(d)
    meshes, nodes, groups = [], [], {g: [] for g in GROUP_ORDER}
    tris_total = 0
    for part in PARTS:
        P, N, C, idx = expand(part); tris_total += len(idx)
        flat_idx = idx.reshape(-1)
        itype, icomp = (np.uint16, 5123) if len(P) < 65535 else (np.uint32, 5125)
        va = add_view(P, 34962); accs.append(dict(bufferView=va, componentType=5126, count=len(P), type='VEC3', min=P.min(0).tolist(), max=P.max(0).tolist())); pa = len(accs) - 1
        vn = add_view(N, 34962); accs.append(dict(bufferView=vn, componentType=5126, count=len(N), type='VEC3')); na = len(accs) - 1
        vc = add_view(C, 34962); accs.append(dict(bufferView=vc, componentType=5121, normalized=True, count=len(C), type='VEC4')); ca = len(accs) - 1
        vi = add_view(flat_idx.astype(itype), 34963); accs.append(dict(bufferView=vi, componentType=icomp, count=len(flat_idx), type='SCALAR', min=[int(flat_idx.min())], max=[int(flat_idx.max())])); ia = len(accs) - 1
        meshes.append(dict(name=part['name'], primitives=[dict(attributes=dict(POSITION=pa, NORMAL=na, COLOR_0=ca), indices=ia, material=mat_names.index(part['mat']), mode=4)]))
        node = dict(name=part['name'], mesh=len(meshes) - 1)
        if np.linalg.norm(part['t']) > 1e-9: node['translation'] = [round(float(x), 6) for x in part['t']]
        if not np.allclose(part['R'], np.eye(3)): node['rotation'] = [round(float(x), 7) for x in mat_to_quat(part['R'])]
        nodes.append(node); groups[part['group']].append(len(nodes) - 1)
    # hierarchy
    gnodes = []
    for g in GROUP_ORDER:
        n = dict(name=g, children=groups[g])
        if g == 'Sword':
            n['translation'] = [float(x) for x in SWORD_T]; n['rotation'] = [round(x, 7) for x in mat_to_quat(SWORD_R)]
            n['extras'] = dict(note='Sword group is leaned 10 degrees toward +X; blade tip is embedded in the log pile.')
        nodes.append(n); gnodes.append(len(nodes) - 1)
    # fix: child nodes of Sword stay local to the group (their own translation is zero)
    nodes.append(dict(name='FireAnchor', translation=list(FIRE_ANCHOR),
                      extras=dict(purpose='Attach the R3F flame/ember/point-light effect here (empty node, no geometry).', units='metres', flameRadius=0.45)))
    gnodes.append(len(nodes) - 1)
    nodes.append(dict(name='Aprameya_Bonfire', children=gnodes,
                      extras=dict(generator='generate_bonfire.py', origin='ground centre', up='+Y', front='+Z', fireAnchor=list(FIRE_ANCHOR))))
    root = len(nodes) - 1
    gltf = dict(asset=dict(version='2.0', generator='Aprameya procedural bonfire generator (numpy)'), scene=0, scenes=[dict(name='Bonfire', nodes=[root])],
                nodes=nodes, meshes=meshes, materials=mats, accessors=accs, bufferViews=views, buffers=[dict(byteLength=len(buf))])
    js = json.dumps(gltf, separators=(',', ':')).encode()
    while len(js) % 4: js += b' '
    while len(buf) % 4: buf.append(0)
    total = 12 + 8 + len(js) + 8 + len(buf)
    with open(path, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, total)); f.write(struct.pack('<I4s', len(js), b'JSON')); f.write(js)
        f.write(struct.pack('<I4s', len(buf), b'BIN\x00')); f.write(bytes(buf))
    return tris_total

def main(out):
    build_sword(); build_shards(); build_base(); build_bones()
    nlogs = build_logs(); build_silhouette(); build_ember_and_debris()
    tris = write_glb(out)
    import os
    print(f'wrote {out}  parts={len(PARTS)} logs={nlogs} bones={len(BONE_CAPS)} tris={tris} size={os.path.getsize(out)/1024:.1f} KiB')

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'apramaya_bonfire_v2.glb')
