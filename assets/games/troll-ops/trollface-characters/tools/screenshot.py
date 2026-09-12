# Renders the built character from a few angles to PNGs for a visual check.
# Run standalone after build_trollface_character.py, or via:
#   blender --background --python tools/build_trollface_character.py --python tools/screenshot.py
import bpy
import math
import os
from mathutils import Vector

here = os.path.dirname(os.path.abspath(__file__))
out_dir = os.path.normpath(os.path.join(here, "..", "character", "_preview"))
os.makedirs(out_dir, exist_ok=True)

scene = bpy.context.scene
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except TypeError:
    scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 640
scene.render.resolution_y = 800
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new("World") if not scene.world else scene.world
scene.world.use_nodes = True
bg = scene.world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.45, 0.55, 0.7, 1.0)

sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", type="SUN"))
sun.data.energy = 3.5
bpy.context.collection.objects.link(sun)
sun.rotation_euler = (math.radians(55), 0, math.radians(35))

fill = bpy.data.objects.new("Fill", bpy.data.lights.new("Fill", type="SUN"))
fill.data.energy = 1.2
bpy.context.collection.objects.link(fill)
fill.rotation_euler = (math.radians(70), 0, math.radians(-120))

cam_data = bpy.data.cameras.new("Cam")
cam = bpy.data.objects.new("Cam", cam_data)
bpy.context.collection.objects.link(cam)
scene.camera = cam
cam_data.lens = 50

target_z = 0.9
for i, (yaw, label) in enumerate([(0, "front"), (100, "three_quarter"), (180, "back")]):
    dist = 2.6
    rad = math.radians(yaw)
    cam.location = Vector((math.sin(rad) * dist, -math.cos(rad) * dist, target_z + 0.15))
    direction = Vector((0, 0, target_z)) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = os.path.join(out_dir, f"{label}.png")
    bpy.ops.render.render(write_still=True)
    print(f"[screenshot] wrote {scene.render.filepath}")
