# Keyboard Warrior - procedural blockout generator
#
# HOW TO RUN
#   1. Open Blender (free: https://www.blender.org/download/)
#   2. Switch to the "Scripting" tab at the top
#   3. Click "Open" and pick this file (or "New" and paste it in)
#   4. Press "Run Script" (the play arrow)
#   5. A .glb lands next to this script, in ../weapons/keyboard_sword/
#
# The sword is built grip-first: the origin sits at the handle so it
# rotates around the hand, not the blade. Units are metres. The whole
# thing is ~1.1m long, oversized on purpose - it should read as absurd.

import bpy
import bmesh
import math
import os
from mathutils import Vector

# ----------------------------------------------------------------------
# Tunables - change these, re-run, iterate on the silhouette
# ----------------------------------------------------------------------

BLADE_LENGTH   = 0.78    # keyboard body, grip to tip
BLADE_WIDTH    = 0.30    # matches a full-size board
BLADE_THICK    = 0.038   # slimmer - a board, not a plank
TIP_LENGTH     = 0.15    # the wedge at the end

# The key field fills the blade face on both sides. Cap size is derived
# from the blade, so changing BLADE_WIDTH/LENGTH rescales the keys instead
# of leaving a bare slab or overflowing the edge.
KEY_COLS       = 8       # keys across the width
KEY_ASPECT     = 1.35    # cap length / width - keeps caps square-ish
KEY_HUES       = 12      # shared RGB materials (NOT one per key)
KEY_GAP        = 0.0065   # wide enough for the backlight to show through
KEY_HEIGHT     = 0.010
KEY_MARGIN     = 0.016   # bezel around the key field

GUARD_WIDTH    = 0.42    # the "U MAD BRO?" crossbar
GUARD_HEIGHT   = 0.052
GUARD_THICK    = 0.075

GRIP_LENGTH    = 0.26
GRIP_RADIUS    = 0.026

POMMEL_RADIUS  = 0.055   # trollface head

# Key legends, top row first. Cycled to fill however many rows the blade
# ends up with, so this does not have to match KEY_COLS/rows exactly.
# A real QWERTY board, because "keyboard sword" only lands if you can read
# the keys.
KEY_LEGENDS = [
    "1234567890",
    "QWERTYUIOP",
    "ASDFGHJKL;",
    "ZXCVBNM,./",
    "UMADBRO?!*",
]

EXPORT_NAME    = "keyboard_sword.glb"


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------

def clear_scene():
    """Wipe everything so re-running is idempotent."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.objects):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def new_box(name, size, location):
    """Axis-aligned box. size/location are (x, y, z) tuples."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = Vector(size)
    return obj


def bevel(obj, width, segments=2):
    mod = obj.modifiers.new(name="Bevel", type="BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(40)
    return mod


def make_material(name, base_color, roughness=0.6, metallic=0.0,
                  emission=None, emission_strength=0.0):
    """Minimal PBR material. Emission drives the RGB key glow."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def hsv_to_rgb(h, s, v):
    """Rainbow ramp for the per-key RGB backlight."""
    i = int(h * 6.0)
    f = h * 6.0 - i
    p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
    return [(v, t, p), (q, v, p), (p, v, t),
            (p, q, v), (t, p, v), (v, p, q)][i % 6]


# ----------------------------------------------------------------------
# Parts
# ----------------------------------------------------------------------
# Layout along +Y: grip at origin, blade extends forward.
#   Y = 0            -> hand / grip centre
#   Y = +GUARD       -> crossguard
#   Y = +BLADE       -> keyboard body
#   Y = -POMMEL      -> trollface head

def build_blade():
    """The keyboard chassis - a long flat box with a wedge tip."""
    y0 = GRIP_LENGTH * 0.5 + GUARD_THICK
    body_len = BLADE_LENGTH - TIP_LENGTH

    body = new_box(
        "Blade_Body",
        (BLADE_WIDTH, body_len, BLADE_THICK),
        (0, y0 + body_len * 0.5, 0),
    )
    bevel(body, 0.004)

    # Tip: a box with the far face collapsed to a chisel edge.
    tip = new_box(
        "Blade_Tip",
        (BLADE_WIDTH, TIP_LENGTH, BLADE_THICK),
        (0, y0 + body_len + TIP_LENGTH * 0.5, 0),
    )
    bpy.context.view_layer.objects.active = tip
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    me = tip.data
    bm = bmesh.new()
    bm.from_mesh(me)
    ys = [v.co.y for v in bm.verts]
    far = max(ys)
    for v in bm.verts:
        if abs(v.co.y - far) < 1e-5:
            v.co.x *= 0.12   # pinch to a point
            v.co.z *= 0.35
    bm.to_mesh(me)
    bm.free()
    bevel(tip, 0.003)

    return [body, tip]


def build_keys():
    """Keycaps covering both blade faces, lit by a shared RGB palette.

    Cap size is derived from the blade dimensions. Both faces get keys -
    it is a sword, you see both sides mid-swing.
    """
    y0 = GRIP_LENGTH * 0.5 + GUARD_THICK
    z_top = BLADE_THICK * 0.5

    # Fit KEY_COLS keys across the usable width.
    usable_w = BLADE_WIDTH - KEY_MARGIN * 2.0
    key_w = (usable_w - KEY_GAP * (KEY_COLS - 1)) / KEY_COLS
    pitch_x = key_w + KEY_GAP
    total_w = KEY_COLS * pitch_x - KEY_GAP

    # Row count follows from the cap aspect ratio rather than being fixed:
    # pinning rows makes caps stretch into strips whenever the blade is
    # long. Rows are then re-fitted to the exact field length so the last
    # row lands flush with the tip.
    field_start_y = y0 + KEY_MARGIN
    field_end_y = y0 + (BLADE_LENGTH - TIP_LENGTH) - KEY_MARGIN
    field_len = field_end_y - field_start_y

    rows = max(int(round(field_len / (key_w * KEY_ASPECT + KEY_GAP))), 1)
    pitch_y = (field_len + KEY_GAP) / float(rows)
    key_l = pitch_y - KEY_GAP

    # A shared palette. Reusing materials keeps the export to a handful of
    # primitives instead of one per key - 990 unique materials would mean
    # ~990 draw calls for a single weapon.
    #
    # The RGB belongs UNDER the caps, not on them. A real backlit board has
    # dark plastic keycaps with the LED beneath, so the colour reads as
    # light bleeding up through the gaps. Colouring the cap tops directly
    # turns the whole blade into a pastel candy grid.
    glow_palette = []
    for i in range(KEY_HUES):
        rgb = hsv_to_rgb(i / float(KEY_HUES), 0.95, 1.0)
        glow_palette.append(make_material(
            f"KeyGlow_{i:02d}",
            base_color=rgb,
            roughness=0.4,
            emission=rgb,
            emission_strength=1.35,
        ))

    # Dark ABS keycap. One material for every cap on the board.
    cap_mat = make_material(
        "Keycap", base_color=(0.022, 0.022, 0.028), roughness=0.6)

    # Legend ink. Slightly emissive so it stays legible on a dark cap in
    # a dim scene - real doubleshot caps are lit from below.
    legend_mat = make_material(
        "Legend", base_color=(0.86, 0.87, 0.90), roughness=0.45,
        emission=(0.86, 0.87, 0.90), emission_strength=0.55)

    keys = []
    for side, z_sign in ((0, 1.0), (1, -1.0)):
        for row in range(rows):
            for col in range(KEY_COLS):
                x = -total_w * 0.5 + pitch_x * col + key_w * 0.5
                y = field_start_y + pitch_y * row + key_l * 0.5

                # Glowing base, slightly larger than the cap that sits on
                # it, so a lit rim shows around all four sides.
                #
                # A single flat slab under the whole field does not work:
                # opaque caps simply occlude it, and light cannot spill
                # sideways in a rasterizer the way it does on a real board.
                # A per-key skirt puts the emissive surface exactly where
                # the light actually escapes.
                base = new_box(
                    f"KeyLight_{side}_{row}_{col}",
                    (key_w + KEY_GAP * 0.85, key_l + KEY_GAP * 0.85,
                     KEY_HEIGHT * 0.55),
                    (x, y, z_sign * (z_top + KEY_HEIGHT * 0.26)),
                )
                t = (col / float(KEY_COLS)) * 0.7 + (row / float(rows)) * 0.3
                assign(base, glow_palette[int(t * KEY_HUES) % KEY_HUES])
                keys.append(base)

                k = new_box(
                    f"Key_{side}_{row}_{col}",
                    (key_w, key_l, KEY_HEIGHT),
                    (x, y, z_sign * (z_top + KEY_HEIGHT * 0.62)),
                )
                # No bevel on caps: invisible at this scale, and it would
                # roughly triple the triangle count of the whole weapon.
                assign(k, cap_mat)
                keys.append(k)

                # Legend. Blank caps are the giveaway that this is a slab
                # with squares on it rather than a keyboard, so every cap
                # gets its character - the letters are the whole joke.
                legend_row = KEY_LEGENDS[(rows - 1 - row) % len(KEY_LEGENDS)]
                glyph = legend_row[col % len(legend_row)]
                if glyph != " ":
                    label = build_engraved_text(
                        glyph,
                        size=key_w * 0.52,
                        location=(x, y,
                                  z_sign * (z_top + KEY_HEIGHT * 1.12)),
                        # Font text stands upright in the XY plane facing
                        # +Z, and the caps also face +/-Z, so the glyph is
                        # already flat on the cap, so it needs NO X rotation
                        # - only a Z-180 to point that up-axis back toward
                        # the grip, where the player reads it from. An X
                        # rotation stands the glyph on edge instead.
                        #
                        # The scene node also rotates the whole model -90
                        # about X to stand the sword up in the hand, so any
                        # rotation here composes with that. Judge this in
                        # the game view, never in the Blender viewport.
                        # Verified empirically: a bare glyph at (0,0,0)
                        # rotation renders right-side-up and readable on
                        # the FRONT face in the actual game camera. Every
                        # rotation guess tried before this made it worse.
                        rotation=(0.0, 0.0, 0.0),
                        extrude=0.0012,
                        resolution=1,
                        flip_y=False,
                    )
                    label.name = f"Legend_{side}_{row}_{col}"
                    assign(label, legend_mat)
                    keys.append(label)

    print(f"[keyboard_sword] key field: {KEY_COLS} x {rows} x2 sides "
          f"({key_w * 1000:.0f} x {key_l * 1000:.0f}mm caps, "
          f"{KEY_HUES} shared materials)")
    return keys


def build_engraved_text(body, size, location, rotation, extrude=0.004,
                        resolution=2, flip_y=False):
    """Extruded 3D text, converted to a mesh.

    Real geometry rather than a texture, so the lettering survives without
    a UV unwrap. Blender's default font is used - it ships with Blender, so
    this needs no font file on disk.

    `resolution` is the curve subdivision. Font curves default to 12, which
    is wildly over-detailed for a 15mm keycap glyph: 224 of them at that
    setting cost ~48k triangles on their own, five times the rest of the
    weapon combined. Drop it for anything small.
    """
    curve = bpy.data.curves.new(type="FONT", name=f"Font_{body}")
    curve.body = body
    curve.size = size
    curve.extrude = extrude
    curve.resolution_u = resolution
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"

    obj = bpy.data.objects.new(f"Text_{body}", curve)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = rotation

    # Curves cannot be joined into a mesh, so convert before assembly.
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    out = bpy.context.active_object

    # Mirroring the mesh beats another rotation guess: the scene node spins
    # the whole model -90 about X, so every rotation authored here composes
    # with that and it is genuinely hard to reason about. Negating Y on the
    # vertices is invariant to whatever the parent does.
    if flip_y:
        me = out.data
        for v in me.vertices:
            v.co.y = -v.co.y
        me.flip_normals()

    return out


def build_guard():
    """Crossguard - the 'U MAD BRO?' bar, lettering included."""
    y = GRIP_LENGTH * 0.5 + GUARD_THICK * 0.5
    guard = new_box(
        "Guard",
        (GUARD_WIDTH, GUARD_THICK, GUARD_HEIGHT),
        (0, y, 0),
    )
    bevel(guard, 0.006, segments=3)

    # Rivet studs along the front face, as in the fabricated prop.
    rivets = []
    count = 11
    span = GUARD_WIDTH * 0.82
    for i in range(count):
        x = -span * 0.5 + span * (i / (count - 1))
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=0.0085, segments=10, ring_count=8,
            location=(x, y - GUARD_THICK * 0.52, -GUARD_HEIGHT * 0.34),
        )
        r = bpy.context.active_object
        r.name = f"Rivet_{i}"
        rivets.append(r)

    # "U MAD BRO?" across the player-facing side of the guard. Sitting
    # proud of the surface rather than cut into it, so it reads at the
    # distance a first-person weapon is actually seen from.
    text = build_engraved_text(
        "U MAD BRO?",
        size=GUARD_HEIGHT * 0.62,
        location=(0, y - GUARD_THICK * 0.5 - 0.001, GUARD_HEIGHT * 0.16),
        rotation=(math.radians(90), 0, 0),
        extrude=0.0035,
    )
    text.name = "Guard_Text"

    return [guard] + rivets + [text]


def build_grip():
    """Wrapped handle - a tapered cylinder with ridges."""
    bpy.ops.mesh.primitive_cylinder_add(
        radius=GRIP_RADIUS, depth=GRIP_LENGTH,
        vertices=16, location=(0, 0, 0),
    )
    grip = bpy.context.active_object
    grip.name = "Grip"
    grip.rotation_euler[0] = math.radians(90)   # stand it along Y

    bpy.context.view_layer.objects.active = grip
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)

    # Ridges for the leather wrap.
    me = grip.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.subdivide_edges(
        bm,
        edges=[e for e in bm.edges
               if abs(e.verts[0].co.y - e.verts[1].co.y) > 1e-4],
        cuts=9, use_grid_fill=False,
    )
    for v in bm.verts:
        band = math.sin(v.co.y * 90.0)
        if abs(v.co.x) > 1e-5 or abs(v.co.z) > 1e-5:
            scale = 1.0 + band * 0.07
            v.co.x *= scale
            v.co.z *= scale
    bm.to_mesh(me)
    bm.free()

    return [grip]


def _face_feature(name, verts_2d, depth, centre, scale, flip_x=False):
    """Extrude a flat 2D outline into a face feature on the pommel.

    verts_2d are (x, z) pairs in a -1..1 unit square; centre is where the
    shape lands in world space. The face looks down -Y, so the outline is
    laid out in X/Z and given thickness along Y.
    """
    bm = bmesh.new()
    ring = []
    for vx, vz in verts_2d:
        x = (-vx if flip_x else vx) * scale
        ring.append(bm.verts.new((centre[0] + x,
                                  centre[1],
                                  centre[2] + vz * scale)))
    face = bm.faces.new(ring)

    # Concave outlines (the grin crescent especially) come out shattered if
    # left as one n-gon - bmesh cannot fan-triangulate them, so the shape
    # renders as disconnected wings. Triangulate before solidifying.
    bmesh.ops.triangulate(bm, faces=[face])
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=depth)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])

    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    return obj


def build_pommel():
    """Trollface head at the butt of the sword.

    The face looks OUT along -Y, down the grip axis - that is the only
    direction it is ever seen from. An earlier version flattened the skull
    on +Z and put the features there, which pointed the whole face sideways
    off the edge of the blade where nobody could see it, leaving a blank
    chrome ball at the pommel.

    The grin, eyes and brows are extruded outlines rather than boxes, so
    the mascot is actually recognisable instead of being two bars and a
    smear.
    """
    y = -GRIP_LENGTH * 0.5 - POMMEL_RADIUS * 0.55
    face_y = y - POMMEL_RADIUS * 0.62      # the flattened front plane
    ink_depth = 0.006
    s = POMMEL_RADIUS                       # feature scale

    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=POMMEL_RADIUS, segments=24, ring_count=18,
        location=(0, y, 0),
    )
    head = bpy.context.active_object
    head.name = "Pommel_Trollface"
    head.scale = (1.06, 0.72, 1.14)         # wide, shallow, tall - a face

    bpy.context.view_layer.objects.active = head
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    # Flatten the FRONT (-Y) into a clean plane to carry the features.
    me = head.data
    bm = bmesh.new()
    bm.from_mesh(me)
    for v in bm.verts:
        if v.co.y < face_y:
            v.co.y = face_y
    bm.to_mesh(me)
    bm.free()

    parts = [head]
    fy = face_y - ink_depth * 0.85          # clear of the skull, not coplanar

    # The grin: a crescent built from a centreline plus a thickness profile
    # that tapers to ZERO at both tips, so the two edges can only meet,
    # never cross. Kept deliberately CONSERVATIVE after an earlier attempt
    # let the corner-hook term overpower the depth term and produced one
    # giant diagonal slash covering half the face instead of a mouth.
    grin_span = 0.85         # half-width of the mouth
    grin_depth = 0.32        # centreline dip at the middle (mouth corners
                             # sit ABOVE this, corners are the reference)
    grin_thick = 0.30        # mouth open-height at the centre
    hook_lift = 0.10         # corners rise only slightly above the corners'
                             # own baseline - subtle smirk, not a slash

    span = 20
    centre = []
    thickness = []
    for k in range(span + 1):
        u = -1.0 + 2.0 * (k / float(span))
        t = abs(u)                                   # 0 at centre, 1 at tips
        # Baseline: shallow smile arc (corners near 0, deepest at centre).
        # Then a SMALL additional upturn right at the tips for the smirk -
        # capped well below the arc's own depth so it cannot invert the
        # whole shape into a slash.
        base = -grin_depth * (1.0 - u * u)
        smirk = hook_lift * (t ** 6)                  # only kicks in near t=1
        c = base + smirk
        centre.append((u * grin_span, c))
        thickness.append(grin_thick * (1.0 - t ** 2) ** 0.7)   # -> 0 at tips

    grin_outline = [(x, y + th * 0.5) for (x, y), th in zip(centre, thickness)]
    grin_outline += [(x, y - th * 0.5)
                     for (x, y), th in reversed(list(zip(centre, thickness)))]
    grin = _face_feature("Pommel_Grin", grin_outline, ink_depth,
                         (0.0, fy, 0.02 * s), s * 0.95)
    parts.append(grin)

    # Teeth: a simple row across the mouth opening. Positioned by eye
    # against a zoomed render rather than derived from the grin's curve -
    # a formula meant to track the curve twice landed the teeth outside
    # the visible mouth opening (once near the eyes, once below the chin),
    # so a fixed, verified offset is more reliable here.
    tooth_count = 7
    tooth_span = grin_span * 0.55
    tooth_w = (tooth_span * 2.0) / tooth_count
    teeth_z = -grin_depth * 0.42 * s   # inside the mouth opening, centred
    for i in range(tooth_count):
        tx = -tooth_span + tooth_w * (i + 0.5)
        tu = tx / grin_span
        arc = -grin_depth * 0.25 * (1.0 - tu * tu) * s  # slight sag, centre lower
        th = s * 0.11 if i % 2 == 0 else s * 0.075
        tooth = new_box(
            f"Pommel_Tooth_{i}",
            (tooth_w * 0.70 * s, ink_depth * 3.0, th),
            (tx * s, fy - ink_depth * 4.0, teeth_z + arc),
        )
        parts.append(tooth)

    # Eyes: narrow slits, close-set, angled - the trollface squint, not
    # round smiley eyes. Kept small and well clear of the brows/grin.
    for i, sx in enumerate((-1.0, 1.0)):
        eye_outline = []
        steps = 14
        for k in range(steps):
            a = (k / float(steps)) * math.tau
            eye_outline.append((math.cos(a) * 1.0, math.sin(a) * 0.22))
        eye = _face_feature(f"Pommel_Eye_{i}", eye_outline, ink_depth,
                            (sx * s * 0.36, fy, s * 0.42), s * 0.24)
        eye.rotation_euler[1] = math.radians(-16.0 * sx)
        parts.append(eye)

    # Brows: thick, arched, sitting clearly above the eyes with a visible
    # gap - the single most recognisable trollface cue.
    for i, sx in enumerate((-1.0, 1.0)):
        brow = new_box(
            f"Pommel_Brow_{i}",
            (s * 0.56, ink_depth, s * 0.12),
            (sx * s * 0.40, fy, s * 0.72),
        )
        brow.rotation_euler[1] = math.radians(26.0 * sx)
        parts.append(brow)
    return parts

# ----------------------------------------------------------------------
# Assemble
# ----------------------------------------------------------------------

def build():
    clear_scene()

    mat_chassis = make_material("Chassis", (0.055, 0.055, 0.062),
                                roughness=0.42, metallic=0.65)
    mat_metal   = make_material("Guard_Metal", (0.62, 0.63, 0.66),
                                roughness=0.28, metallic=1.0)
    mat_leather = make_material("Grip_Leather", (0.19, 0.09, 0.05),
                                roughness=0.85)
    mat_troll   = make_material("Trollface_Metal", (0.74, 0.75, 0.78),
                                roughness=0.22, metallic=1.0)
    mat_ink     = make_material("Trollface_Ink", (0.008, 0.008, 0.011),
                                roughness=0.85, metallic=0.0)
    mat_teeth   = make_material("Trollface_Teeth", (0.92, 0.90, 0.84),
                                roughness=0.5, metallic=0.0)

    blade  = build_blade()
    keys   = build_keys()
    guard  = build_guard()
    grip   = build_grip()
    pommel = build_pommel()

    for o in blade:
        assign(o, mat_chassis)
    # Dark lettering on the chrome bar so "U MAD BRO?" is legible.
    for o in guard:
        assign(o, mat_ink if "Text" in o.name else mat_metal)
    for o in grip:
        assign(o, mat_leather)
    # Chrome skull, dark ink for the grin/eyes/brows, off-white for teeth.
    for o in pommel:
        if o.name == "Pommel_Trollface":
            assign(o, mat_troll)
        elif "Tooth" in o.name:
            assign(o, mat_teeth)
        else:
            assign(o, mat_ink)

    everything = blade + keys + guard + grip + pommel

    # Apply modifiers, then join into a single mesh.
    for o in everything:
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)

    bpy.ops.object.select_all(action="DESELECT")
    for o in everything:
        o.select_set(True)
    bpy.context.view_layer.objects.active = blade[0]
    bpy.ops.object.join()

    sword = bpy.context.active_object
    sword.name = "KeyboardSword"

    # Origin at the grip so it swings around the hand, and transforms
    # applied so Godot imports it at a sane scale/rotation.
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # Smooth shading with an angle threshold keeps the keycaps crisp
    # while the grip and pommel round off. Blender 4.1 removed
    # use_auto_smooth in favour of shade_smooth_by_angle().
    if hasattr(bpy.ops.object, "shade_smooth_by_angle"):
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    else:
        bpy.ops.object.shade_smooth()
        if hasattr(sword.data, "use_auto_smooth"):
            sword.data.use_auto_smooth = True
            sword.data.auto_smooth_angle = math.radians(35)

    return sword


def export(sword):
    here = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() \
        else bpy.path.abspath("//")
    out_dir = os.path.normpath(os.path.join(here, "..", "weapons",
                                            "keyboard_sword"))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, EXPORT_NAME)

    bpy.ops.object.select_all(action="DESELECT")
    sword.select_set(True)
    bpy.context.view_layer.objects.active = sword

    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,             # Godot expects +Y up
        export_apply=True,
        export_materials="EXPORT",
    )

    tris = sum(len(p.vertices) - 2 for p in sword.data.polygons)
    print(f"[keyboard_sword] exported -> {out_path}")
    print(f"[keyboard_sword] ~{tris} triangles")
    return out_path


if __name__ == "__main__":
    sword = build()
    export(sword)
