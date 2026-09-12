extends RangedWeapon

## Green Candles - backpack-tank chemical launcher.
##
## Tapered brass-collared horn body with a glowing green fuel cylinder
## riding on top, fed by a hose from a side tank. Held level and aimed
## forward like a rifle/rocket launcher - the barrel runs along local -Z,
## same as every other view model, not stacked vertically like a bottle
## rocket (an earlier revision of the Blender build got that wrong; see
## tools/build_green_candles.py for the fix and how it was verified).
## Semi-auto, heavy hit, slow reload - a hard-hitting primary rather than
## a spray weapon.
##
## The fuel cell is its OWN node (Model/CellSeated in the .tscn, built
## from the separate green_candles_cell.glb), not fused into the body
## mesh, specifically so the reload animation can pull it out and drop a
## fresh one in rather than faking the swap with a material flash.
##
## Builds its own aim/fire/reload animations in code so the weapon is
## playable before any hand-authored animation exists - same approach as
## keyboard_sword.gd. Once real animations exist, delete
## _build_animations() and RangedWeapon will use those instead.

## Resting pose in view space. Held level and aimed forward, rifle-style -
## shoulder height, slightly right of center, barrel pointed at the
## crosshair rather than up in the air.
##
## The yaw here is doing real work, not just cosmetic angling: the camera
## looks straight down -Z, and the barrel ALSO runs along local -Z, so at
## yaw=0 the gun is seen almost perfectly end-on and reads as a stubby
## blob instead of a rifle silhouette - the classic first-person "how do
## you actually see the gun's profile" problem. This launcher is short
## and fat (~0.4m barrel at ~0.09m radius, roughly an 8:1 ratio, versus a
## slender rifle's 25-30:1), so the usual few-degree view-model yaw barely
## reveals any length at all here - -28 and -38 were both tried and still
## read end-on when rendered; -55 is what actually showed a real tapered
## silhouette. Verified by rendering at several values, not assumed from
## one look.
const REST_POS := Vector3(0.24, -0.24, -0.62)
const REST_ROT := Vector3(-2.0, -55.0, -6.0)   # degrees

## Where the fuel cell sits when seated, relative to this node - matches
## CellSeated's transform in green_candles.tscn. Measured, not guessed:
## tools/inspect_model.gd loaded a debug export of JUST the CellSocket
## part and printed its real AABB (center ~= Y 0.31, Z -0.017; the cell's
## own mesh origin is at its base, from build_cell()'s origin_set, so it
## seats exactly on the socket's top face at socket_center_y + half the
## socket's height).
const CELL_SEATED_POS := Vector3(0.0, 0.319, -0.017)
## Where it goes mid-reload: pulled up and back, out of the socket.
const CELL_EJECTED_POS := Vector3(0.0, 0.319 + 0.16, -0.017 + 0.20)
## Where the fresh cell drops in from before seating.
const CELL_FRESH_START_POS := Vector3(0.0, 0.319 + 0.22, -0.017 - 0.08)

@export var build_animations_in_code: bool = true


func _ready() -> void:
	# Snap to the rest pose so the scene's saved transform can never drift
	# out of sync with REST_POS/REST_ROT - same convention as keyboard_sword.
	position = REST_POS
	rotation_degrees = REST_ROT

	if build_animations_in_code:
		_build_animations()
	super._ready()


func _build_animations() -> void:
	if _anim == null:
		_anim = AnimationPlayer.new()
		_anim.name = "AnimationPlayer"
		add_child(_anim)

	var lib := AnimationLibrary.new()
	lib.add_animation(aim_idle_animation, _make_aim_idle())
	lib.add_animation(fire_animation, _make_fire())
	lib.add_animation(reload_animation, _make_reload())

	if _anim.has_animation_library(""):
		_anim.remove_animation_library("")
	_anim.add_animation_library("", lib)


func _pos_rot_anim(length: float, loop: bool) -> Animation:
	var a := Animation.new()
	a.length = length
	a.loop_mode = Animation.LOOP_LINEAR if loop else Animation.LOOP_NONE

	var pos_track := a.add_track(Animation.TYPE_VALUE)
	a.track_set_path(pos_track, ".:position")
	a.value_track_set_update_mode(pos_track, Animation.UPDATE_CONTINUOUS)

	var rot_track := a.add_track(Animation.TYPE_VALUE)
	a.track_set_path(rot_track, ".:rotation_degrees")
	a.value_track_set_update_mode(rot_track, Animation.UPDATE_CONTINUOUS)

	return a


## Idle "orienting the weapon at the target" hold: a slow settle into the
## aimed pose with a light breathing sway, rather than a dead-still prop.
func _make_aim_idle() -> Animation:
	var a := _pos_rot_anim(3.6, true)
	var bob := 0.008

	var samples := 9
	for i in samples:
		var t := (float(i) / float(samples - 1)) * a.length
		var phase := (float(i) / float(samples - 1)) * TAU
		var offset := Vector3(
			sin(phase) * bob * 0.5,
			-absf(cos(phase)) * bob * 0.7,
			cos(phase * 0.5) * bob * 0.3,
		)
		a.track_insert_key(0, t, REST_POS + offset)
		a.track_insert_key(1, t, REST_ROT + Vector3(
			cos(phase) * 0.7, sin(phase) * 0.9, 0.0))

	return a


## The shot: a straight-back recoil punch along the barrel's own -Z aim
## axis (this now IS a rifle-style forward-pointed barrel, so recoil
## kicks back toward the shooter and up, same as any other gun here)
## followed by a settle heavier than the snap - selling the weight of
## launching a payload rather than a rifle round.
func _make_fire() -> Animation:
	var a := _pos_rot_anim(0.32, false)

	var keys := [
		[0.00, REST_POS,                                REST_ROT],
		[0.04, REST_POS + Vector3(0.0, 0.006, 0.03),    REST_ROT + Vector3(-2.0, 0.3, 0.0)],   # brace
		[0.08, REST_POS + Vector3(0.0, 0.03, 0.09),     REST_ROT + Vector3(7.0, -0.8, -1.2)],  # muzzle release
		[0.17, REST_POS + Vector3(0.0, 0.05, 0.15),     REST_ROT + Vector3(10.0, -1.4, -2.0)], # peak kick
		[0.32, REST_POS,                                REST_ROT],                             # settle
	]

	for k in keys:
		a.track_insert_key(0, k[0], k[1])
		a.track_insert_key(1, k[0], k[2])

	a.track_set_interpolation_type(0, Animation.INTERPOLATION_CUBIC)
	a.track_set_interpolation_type(1, Animation.INTERPOLATION_CUBIC)

	# The projectile spawns exactly when the barrel is at its most
	# "pointed at the target" extended frame, not on the click - matching
	# MeleeWeapon's hit-window convention of gating the real effect off an
	# animation mark rather than the input event.
	var m := a.add_track(Animation.TYPE_METHOD)
	a.track_set_path(m, ".")
	a.track_insert_key(m, 0.08, {"method": "_muzzle_release", "args": []})

	return a


## Reload: the empty cell pops up out of its socket, tips back and out of
## view (as if tossed aside), then a fresh one drops in from above and
## seats with a settle. The WEAPON also dips/tilts toward the player
## throughout, as if being worked on, same idea as the previous version -
## but this time the cell itself is the thing that visibly changes.
##
## Keyframed in fractions of [0, 1] and stretched to reload_time by
## RangedWeapon.try_reload() via speed_scale, so retiming from the
## Inspector doesn't require re-authoring this clip.
func _make_reload() -> Animation:
	var a := Animation.new()
	a.length = 1.0
	a.loop_mode = Animation.LOOP_NONE

	var gun_pos := a.add_track(Animation.TYPE_VALUE)
	a.track_set_path(gun_pos, ".:position")
	a.value_track_set_update_mode(gun_pos, Animation.UPDATE_CONTINUOUS)
	var gun_rot := a.add_track(Animation.TYPE_VALUE)
	a.track_set_path(gun_rot, ".:rotation_degrees")
	a.value_track_set_update_mode(gun_rot, Animation.UPDATE_CONTINUOUS)

	var cell_pos := a.add_track(Animation.TYPE_VALUE)
	a.track_set_path(cell_pos, "Model/CellSeated:position")
	a.value_track_set_update_mode(cell_pos, Animation.UPDATE_CONTINUOUS)
	var cell_rot := a.add_track(Animation.TYPE_VALUE)
	a.track_set_path(cell_rot, "Model/CellSeated:rotation_degrees")
	a.value_track_set_update_mode(cell_rot, Animation.UPDATE_CONTINUOUS)
	var cell_vis := a.add_track(Animation.TYPE_VALUE)
	a.track_set_path(cell_vis, "Model/CellSeated:visible")
	a.value_track_set_update_mode(cell_vis, Animation.UPDATE_DISCRETE)

	var dip := Vector3(-0.05, -0.16, 0.04)
	var tilt := Vector3(-16.0, 10.0, -8.0)

	var gun_keys := [
		[0.00, REST_POS,               REST_ROT],
		[0.14, REST_POS + dip,         REST_ROT + tilt],          # pull down and in
		[0.85, REST_POS + dip * 0.4,   REST_ROT + tilt * 0.3],    # hold through the swap
		[1.00, REST_POS,               REST_ROT],
	]
	for k in gun_keys:
		a.track_insert_key(gun_pos, k[0] * a.length, k[1])
		a.track_insert_key(gun_rot, k[0] * a.length, k[2])

	# The empty cell: seated -> pops up and tips out -> gone (hidden once
	# it's fully clear, rather than actually freeing the node, since the
	# same node instance is reused as "the next mag's cell" each reload).
	var eject_keys := [
		[0.00, CELL_SEATED_POS,   Vector3.ZERO],
		[0.20, CELL_SEATED_POS + Vector3(0, 0.05, 0), Vector3(6, 0, 4)],   # pop loose
		[0.38, CELL_EJECTED_POS, Vector3(30, 10, 60)],                    # tipped out and clear
	]
	for k in eject_keys:
		a.track_insert_key(cell_pos, k[0] * a.length, k[1])
		a.track_insert_key(cell_rot, k[0] * a.length, k[2])
	a.track_insert_key(cell_vis, 0.0 * a.length, true)
	a.track_insert_key(cell_vis, 0.40 * a.length, false)

	# The fresh cell: appears above the socket, drops in, settles level -
	# same node, so this key range starts exactly where the ejected one's
	# visibility turned off.
	var insert_keys := [
		[0.55, CELL_FRESH_START_POS, Vector3(-20, -8, 0)],
		[0.72, CELL_SEATED_POS + Vector3(0, 0.03, 0), Vector3(-4, -2, 0)],  # drop toward the socket
		[0.85, CELL_SEATED_POS + Vector3(0, -0.01, 0), Vector3(2, 0, 0)],   # overshoot/settle
		[1.00, CELL_SEATED_POS, Vector3.ZERO],
	]
	a.track_insert_key(cell_vis, 0.55 * a.length, true)
	for k in insert_keys:
		a.track_insert_key(cell_pos, k[0] * a.length, k[1])
		a.track_insert_key(cell_rot, k[0] * a.length, k[2])

	for t in [cell_pos, cell_rot, gun_pos, gun_rot]:
		a.track_set_interpolation_type(t, Animation.INTERPOLATION_CUBIC)

	return a
