#!/bin/bash
#
# Syntax-checks every world module and the manifest. Run before every commit.
# No dependencies beyond node and python3, both already on a Mac with dev tools.
#
set -u
cd "$(dirname "$0")/.."

failed=0

for f in worlds/*.js; do
    [ -e "$f" ] || continue
    if node --input-type=module --check < "$f" 2>/tmp/p27check.err; then
        echo "ok      $f"
    else
        echo "BROKEN  $f"
        sed 's/^/        /' /tmp/p27check.err
        failed=1
    fi
done

if python3 -c "import json; json.load(open('worlds/index.json'))" 2>/tmp/p27check.err; then
    echo "ok      worlds/index.json"
else
    echo "BROKEN  worlds/index.json"
    sed 's/^/        /' /tmp/p27check.err
    failed=1
fi

# Everything the manifest lists must exist on disk, and every scene on disk
# should be listed — a world the manifest misses is a world the iPad never sees.
python3 - <<'PY'
import json, os, sys
manifest = json.load(open('worlds/index.json'))
bad = False
listed = set()
for world in manifest.get('worlds', []):
    for name in [world.get('scene', '')] + world.get('files', []):
        listed.add(name)
        if not os.path.exists(os.path.join('worlds', name)):
            print(f"BROKEN  manifest lists worlds/{name} but it does not exist")
            bad = True
for name in os.listdir('worlds'):
    if name.endswith('.scene.js') and name not in listed:
        print(f"note    worlds/{name} exists but the manifest does not list it")
sys.exit(1 if bad else 0)
PY
[ $? -ne 0 ] && failed=1

# The performance budget (CLAUDE.md). Only worlds touched in this session are
# held to it - older worlds are grandfathered until the next time one is edited,
# at which point it goes on the same diet as everything new.
changed=$(git status --porcelain -- worlds 2>/dev/null | awk '{print $NF}' | grep '\.scene\.js$')
if [ -n "$changed" ]; then
python3 - $changed <<'PERF'
import re, sys
bad = False
for path in sys.argv[1:]:
    try:
        text = open(path).read()
    except OSError:
        continue
    lights = len(re.findall(r'new\s+THREE\.(?:Point|Spot|Directional|RectArea)Light\b', text))
    meshes = len(re.findall(r'new\s+THREE\.Mesh\(', text))
    if lights > 4:
        print(f"BROKEN  {path}: {lights} real-time lights (budget: 4 - Ambient/Hemisphere are free).")
        print( "        Make lamps emissive meshes and let world.bloom carry the glow;")
        print( "        keep real lights for the one or two that visibly fall on surfaces.")
        bad = True
    if meshes > 150:
        print(f"BROKEN  {path}: {meshes} individual meshes (budget: ~120).")
        print( "        Use InstancedMesh for repeats and merge static geometry.")
        bad = True
    elif meshes > 100:
        print(f"note    {path}: {meshes} meshes - instance or merge before it grows.")
if not bad:
    print("ok      performance budget")
sys.exit(1 if bad else 0)
PERF
[ $? -ne 0 ] && failed=1
fi

exit $failed
