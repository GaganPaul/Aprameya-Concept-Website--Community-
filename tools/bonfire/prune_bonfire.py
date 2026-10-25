#!/usr/bin/env python3
"""Prune apramaya_bonfire_v2.glb -> minimal bonfire: sword + charred logs + base + ember core + FireAnchor."""
import json, struct, sys
REMOVE_GROUPS = {'StoneShards', 'BoneElements', 'Silhouette'}
REMOVE_PREFIX = ('Bonfire_Base_GroundPlate',)

def main(src, dst):
    d = open(src, 'rb').read()
    jl, _ = struct.unpack('<I4s', d[12:20]); js = json.loads(d[20:20+jl]); off = 20 + jl
    bl, _ = struct.unpack('<I4s', d[off:off+8]); bin_ = d[off+8:off+8+bl]
    nodes = js['nodes']
    def keep(i):
        n = nodes[i]['name']; return n not in REMOVE_GROUPS and not n.startswith(REMOVE_PREFIX)
    for n in nodes:
        if 'children' in n: n['children'] = [c for c in n['children'] if keep(c)]
    reach = []
    def walk(i):
        reach.append(i)
        for c in nodes[i].get('children', []): walk(c)
    for r in js['scenes'][0]['nodes']: walk(r)
    nmap = {o: k for k, o in enumerate(reach)}
    used_meshes = sorted({nodes[i]['mesh'] for i in reach if 'mesh' in nodes[i]}); mmap = {o: k for k, o in enumerate(used_meshes)}
    used_mats = sorted({p['material'] for m in used_meshes for p in js['meshes'][m]['primitives']}); matmap = {o: k for k, o in enumerate(used_mats)}
    acc_old = []
    for m in used_meshes:
        for p in js['meshes'][m]['primitives']:
            acc_old += list(p['attributes'].values()) + [p['indices']]
    acc_old = sorted(set(acc_old)); amap = {o: k for k, o in enumerate(acc_old)}
    newbin = bytearray(); newbv = []; bvmap = {}
    for o in sorted({js['accessors'][a]['bufferView'] for a in acc_old}):
        v = js['bufferViews'][o]
        while len(newbin) % 4: newbin.append(0)
        nv = dict(v); nv['byteOffset'] = len(newbin); newbin += bin_[v['byteOffset']:v['byteOffset']+v['byteLength']]
        bvmap[o] = len(newbv); newbv.append(nv)
    accs = []
    for a in acc_old:
        na = dict(js['accessors'][a]); na['bufferView'] = bvmap[na['bufferView']]; accs.append(na)
    meshes = []
    for m in used_meshes:
        nm = json.loads(json.dumps(js['meshes'][m]))
        for p in nm['primitives']:
            p['attributes'] = {k: amap[v] for k, v in p['attributes'].items()}; p['indices'] = amap[p['indices']]; p['material'] = matmap[p['material']]
        meshes.append(nm)
    newnodes = []
    for i in reach:
        n = json.loads(json.dumps(nodes[i]))
        if 'children' in n: n['children'] = [nmap[c] for c in n['children']]
        if 'mesh' in n: n['mesh'] = mmap[n['mesh']]
        newnodes.append(n)
    js['nodes'] = newnodes; js['meshes'] = meshes; js['accessors'] = accs; js['bufferViews'] = newbv
    js['materials'] = [js['materials'][o] for o in used_mats]
    js['scenes'][0]['nodes'] = [nmap[r] for r in js['scenes'][0]['nodes']]
    while len(newbin) % 4: newbin.append(0)
    js['buffers'] = [{'byteLength': len(newbin)}]
    js.setdefault('extras', {})['pruned'] = 'removed StoneShards, BoneElements, Silhouette, GroundPlates'
    jb = json.dumps(js, separators=(',', ':')).encode()
    while len(jb) % 4: jb += b' '
    total = 12 + 8 + len(jb) + 8 + len(newbin)
    open(dst, 'wb').write(struct.pack('<4sII', b'glTF', 2, total) + struct.pack('<I4s', len(jb), b'JSON') + jb + struct.pack('<I4s', len(newbin), b'BIN\0') + bytes(newbin))
    print('wrote', dst, total // 1024, 'KiB;', len(newnodes), 'nodes,', len(meshes), 'meshes,', len(js['materials']), 'materials')
main(sys.argv[1], sys.argv[2])
