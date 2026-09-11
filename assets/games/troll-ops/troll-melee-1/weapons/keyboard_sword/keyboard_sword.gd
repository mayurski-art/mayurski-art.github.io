extends MeleeWeapon

## Keyboard Warrior - "the keyboard is mightier than the sword".
##
## Builds its own swing animations in code so the weapon is playable
## before any hand-authored animation exists. Once you author real
## animations in Blender or Godot's editor, delete _build_animations()
## and the AnimationPlayer will use yours instead.

## Resting pose in view space. Right side, angled across the screen.
const REST_POS := Vector3(0.30, -0.30, -0.62)
const REST_ROT := Vector3(34.0, -16.0, 18.0)   # degrees - X rolls the key face into view

@export var build_animations_in_code: bool = true


func _ready() -> void:
	# Snap to the rest pose so the scene's saved transform can never drift
	# out of sync with REST_POS/REST_ROT. This is the single source of truth.
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
	lib.add_animation("idle", _make_idle())
	lib.add_animation("swing_1", _make_swing(false))
	lib.add_animation("swing_2", _make_swing(true))

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


func _make_idle() -> Animation:
	var a := _pos_rot_anim(3.2, true)
	var bob := 0.012

	# Slow figure-eight breathing bob.
	var samples := 9
	for i in samples:
		var t := (float(i) / float(samples - 1)) * a.length
		var phase := (float(i) / float(samples - 1)) * TAU
		var offset := Vector3(
			sin(phase) * bob * 0.6,
			-abs(cos(phase)) * bob,
			0.0,
		)
		a.track_insert_key(0, t, REST_POS + offset)
		a.track_insert_key(1, t, REST_ROT + Vector3(
			cos(phase) * 1.4, sin(phase) * 1.8, 0.0))

	return a


func _make_swing(mirrored: bool) -> Animation:
	## A diagonal overhead chop. Mirrored alternates the direction so
	## consecutive hits don't look identical.
	var a := _pos_rot_anim(0.58, false)
	var s := -1.0 if mirrored else 1.0

	# Keyframes: wind-up, accelerate through the arc, overshoot, recover.
	var keys := [
		# time,  position,                              rotation (deg)
		[0.00, REST_POS,                                 REST_ROT],
		[0.11, REST_POS + Vector3(0.10 * s, 0.16, 0.10), REST_ROT + Vector3(-38, 26 * s, -22 * s)],
		[0.26, REST_POS + Vector3(-0.22 * s, -0.30, -0.30), REST_ROT + Vector3(62, -48 * s, 38 * s)],
		[0.36, REST_POS + Vector3(-0.30 * s, -0.40, -0.22), REST_ROT + Vector3(78, -62 * s, 50 * s)],
		[0.58, REST_POS,                                 REST_ROT],
	]

	for k in keys:
		a.track_insert_key(0, k[0], k[1])
		a.track_insert_key(1, k[0], k[2])

	# Ease the wind-up, snap the strike.
	a.track_set_interpolation_type(0, Animation.INTERPOLATION_CUBIC)
	a.track_set_interpolation_type(1, Animation.INTERPOLATION_CUBIC)

	# Hit window: open as the blade starts its descent, close after the
	# follow-through. These call-method tracks are what MeleeWeapon looks
	# for - their presence disables the timer fallback.
	var m := a.add_track(Animation.TYPE_METHOD)
	a.track_set_path(m, ".")
	a.track_insert_key(m, 0.19, {"method": "_open_window", "args": []})
	a.track_insert_key(m, 0.40, {"method": "_close_window", "args": []})

	return a
