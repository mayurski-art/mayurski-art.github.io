"""
Undergrin's occlusion bake (doc "Troll Forces: Undergrin in Blender",
decision 1): the seven ug-*.glb are imported together, so each shades the
others, and each gets a Cycles ambient-occlusion bake on its second UV set
(TEXCOORD_1, unwrapped by the build), saved linear as ug-<name>-ao.webp
beside it. No sun, no sky light, no lamps: the station stays the modded
full-bright flat paint, and the game multiplies this in at maps/undergrin.js
UG_AO (0 = today's look to the pixel, 1 = the full bake).

Run after build_undergrin.blender.py:
  blender --background --python bake_undergrin_ao.blender.py [-- shell trains]
"""
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from bake_kit import bake_ao  # noqa: E402

# atlas size per GLB (the build packs its UV set for the same size)
SIZES = {"shell": 2048, "concourse": 2048, "platforms": 2048, "escalators": 1024, "trains": 2048, "shops": 1024, "plant": 1024}
DISTANCE = 2.0   # m: how far a corner or a prop darkens the faces round it
SAMPLES = 64

want = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else list(SIZES)
bpy.ops.wm.read_factory_settings(use_empty=True)
objs = {}
for name in SIZES:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, "ug-%s.glb" % name))
    objs[name] = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    print("imported ug-%s: %d mesh object(s), %d UV layers" % (name, len(objs[name]), len(objs[name][0].data.uv_layers) if objs[name] else 0))
for name in want:
    # the occlusion UV set is the last one: the quantized GLBs carry no
    # first set on their flat-painted faces
    uvi = len(objs[name][0].data.uv_layers) - 1
    bake_ao(objs[name], os.path.join(HERE, "ug-%s-ao.webp" % name), res=SIZES[name], samples=SAMPLES, distance=DISTANCE, uv_index=uvi)
