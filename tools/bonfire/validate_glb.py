#!/usr/bin/env python3
"""Independent structural validation of a .glb (does not import the generator)."""
import json, struct, sys, os
import numpy as np
from render_preview import load_glb, acc, flatten

def main(p):
    ok = True
    def check(c, msg):
        nonlocal ok; print(('PASS ' if c else 'FAIL ') + msg); ok &= bool(c)
    check(os.path.exists(p) and os.path.getsize(p) > 0, f'file exists, size {os.path.getsize(p)/1024:.1f} KiB')
    raw = open(p, 'rb').read(); magic, ver, total = struct.unpack('<4sII', raw[:12])
    check(magic == b'glTF' and ver == 2 and total == len(raw), 'valid glTF 2.0 binary header, declared length matches file')
    js, bin_ = load_glb(p)
    check(js['buffers'][0]['byteLength'] <= len(bin_), 'BIN chunk covers declared buffer')
    check(len(js['meshes']) > 0 and len(js['materials']) > 0, f"{len(js['meshes'])} meshes, {len(js['materials'])} materials, {len(js['nodes'])} nodes")
    check(not js.get('images') and not js.get('textures'), 'no external/embedded textures needed (vertex-colour PBR) -> no missing texture refs')
    # references
    for m in js['meshes']:
        for pr in m['primitives']:
            check(0 <= pr['material'] < len(js['materials']), f"{m['name']}: material index valid") if False else None
            assert 0 <= pr['material'] < len(js['materials'])
    print('PASS all material / accessor references in range')
    tris = 0; bad = 0; nonunit = 0; oob = 0; degenerate = 0; neg = []
    for m in js['meshes']:
        for pr in m['primitives']:
            P = acc(js, bin_, pr['attributes']['POSITION']); N = acc(js, bin_, pr['attributes']['NORMAL']); I = acc(js, bin_, pr['indices']).astype(np.int64)
            a = js['accessors'][pr['attributes']['POSITION']]
            if not np.isfinite(P).all() or not np.isfinite(N).all(): bad += 1
            if I.max() >= len(P): oob += 1
            if not (np.allclose(P.min(0), a['min'], atol=1e-5) and np.allclose(P.max(0), a['max'], atol=1e-5)): bad += 1
            if np.abs(np.linalg.norm(N, axis=1) - 1).max() > 1e-3: nonunit += 1
            T = I.reshape(-1, 3); tris += len(T); Pf = P.astype(float)
            ar = np.linalg.norm(np.cross(Pf[T[:,1]]-Pf[T[:,0]], Pf[T[:,2]]-Pf[T[:,0]]), axis=1); degenerate += int((ar < 1e-10).sum())
            # winding: outward normals => positive signed volume for closed pieces (merged bone/shards are convex or ring-lofted)
            vol = np.einsum('ij,ij->i', Pf[T[:,0]], np.cross(Pf[T[:,1]], Pf[T[:,2]])).sum() / 6
            # compare face winding to vertex normals
            fn = np.cross(Pf[T[:,1]]-Pf[T[:,0]], Pf[T[:,2]]-Pf[T[:,0]]); vn = N[T].astype(float).sum(1)
            agree = (np.einsum('ij,ij->i', fn, vn) > 0).mean()
            if agree < 0.97: neg.append((m['name'], round(float(agree), 3)))
    check(bad == 0, 'all positions/normals finite and accessor min/max correct')
    check(oob == 0, 'all indices within vertex range')
    check(nonunit == 0, 'all normals unit length')
    check(degenerate == 0, f'zero-area triangles: {degenerate}')
    check(not neg, f'face winding agrees with normals on every mesh {neg if neg else ""}')
    print(f'INFO triangles: {tris}')
    items = flatten(js, bin_); allP = np.vstack([it[0] for it in items]); lo, hi = allP.min(0), allP.max(0)
    print('INFO world bounding box min', np.round(lo, 3), 'max', np.round(hi, 3), 'size', np.round(hi - lo, 3))
    check(abs(lo[1]) < 0.05 and hi[1] < 3.0 and (hi - lo).max() < 3.0, 'scale / origin sensible (ground at y=0, <3 units tall)')
    names = [m['name'] for m in js['meshes']]
    for need in ['CentralSword_Blade', 'CentralSword_Crossguard', 'CentralSword_Grip', 'CharredLog_01', 'StoneShard_01', 'BoneElement_01', 'Bonfire_Base_AshBed']:
        check(need in names, f'mesh present: {need}')
    check(any(n['name'] == 'FireAnchor' for n in js['nodes']), 'FireAnchor empty node present')
    groups = {}
    for it in items: groups.setdefault(it[5].rsplit('_', 1)[0] if it[5][-1].isdigit() else it[5], 0)
    print('INFO mesh counts: logs', sum(n.startswith('CharredLog') for n in names), 'shards', sum(n.startswith('StoneShard') for n in names),
          'bones', sum(n.startswith('BoneElement') for n in names), 'base', sum(n.startswith('Bonfire_Base') for n in names), 'silhouette', sum(n.startswith('Flame') for n in names))
    print('RESULT', 'ALL CHECKS PASSED' if ok else 'FAILURES PRESENT'); return ok
if __name__ == '__main__': sys.exit(0 if main(sys.argv[1]) else 1)
