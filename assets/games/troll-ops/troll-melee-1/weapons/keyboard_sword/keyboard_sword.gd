extends MeleeWeapon

## Keyboard Warrior - "the keyboard is mightier than the sword".
##
## Builds its own swing animations in code so the weapon is playable
## before any hand-authored animation exists. Once you author real
## animations in Blender or Godot's editor, delete _build_animations()
## and the AnimationPlayer will use yours instead.

## Resting pose in view space. Right side, angled across the screen.
const REST_POS := Vector3(0.44, -0.52, -0.78)
const REST_ROT := Vector3(15.0, -20.0, 20.0)   # degrees - angled across the view

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

	# Two attacks that read as different techniques rather than the same
	# cut flipped over: a right-to-left diagonal chop, and a straight
	# thrust. The old mirrored left-to-right chop was cut - alternating a
	# swing with its own mirror looks like the arm snapping back and forth.
	var lib := AnimationLibrary.new()
	lib.add_animation("idle", _make_idle())
	lib.add_animation("swing_1", _make_swing())
	lib.add_animation("thrust", _make_thrust())

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


## How far out along the blade the "business end" sits, in local space.
## The swing is authored as the path THIS point takes, not as raw node
## rotations - a few degrees of roll move the tip further than any
## plausible hand movement, so keyframing rotation directly makes the tip
## wander backwards even when every position offset points forward.
const TIP_LOCAL := Vector3(0.0, 0.0, -0.9)


## A basis whose -Z axis points along `dir`, rolled `roll_deg` about it.
## Falls back to a safe up vector when the blade points straight up or down,
## which would otherwise make the cross product degenerate.
func _basis_pointing(dir: Vector3, roll_deg: float) -> Basis:
	var forward := dir.normalized()
	var up := Vector3.UP
	if absf(forward.dot(up)) > 0.985:
		up = Vector3.BACK
	var right := up.cross(forward).normalized()
	var true_up := forward.cross(right).normalized()
	var basis := Basis(right, true_up, -forward)
	return basis.rotated(forward, deg_to_rad(roll_deg))


## Turns a list of [time, tip offset, roll] keys into an animation.
##
## Every attack is authored as the path the blade TIP takes, then the grip
## transform is solved backwards from it. Keyframing node rotation directly
## does not work here: a few degrees of roll move the tip further than any
## plausible hand movement, so the tip wanders backwards even when every
## position offset points forward.
func _tip_path_anim(length: float, keys: Array,
		open_at: float, close_at: float) -> Animation:
	var a := _pos_rot_anim(length, false)

	var rest_basis := Basis.from_euler(Vector3(
		deg_to_rad(REST_ROT.x), deg_to_rad(REST_ROT.y), deg_to_rad(REST_ROT.z)))
	var rest_tip := REST_POS + rest_basis * TIP_LOCAL

	for k in keys:
		var t: float = k[0]
		var tip_target: Vector3 = rest_tip + (k[1] as Vector3)
		var roll: float = k[2]

		# Point the blade at the tip target, then place the grip so the tip
		# lands exactly there. Rotation follows the arc instead of fighting it.
		var basis := rest_basis
		if t > 0.0 and t < length:
			var dir := (tip_target - REST_POS).normalized()
			basis = _basis_pointing(dir, roll)

		a.track_insert_key(0, t, tip_target - basis * TIP_LOCAL)
		a.track_insert_key(1, t, basis.get_euler() * (180.0 / PI))

	# Ease the wind-up, snap the strike.
	a.track_set_interpolation_type(0, Animation.INTERPOLATION_CUBIC)
	a.track_set_interpolation_type(1, Animation.INTERPOLATION_CUBIC)

	# Hit window. These call-method tracks are what MeleeWeapon looks for -
	# their presence disables its timer fallback.
	var m := a.add_track(Animation.TYPE_METHOD)
	a.track_set_path(m, ".")
	a.track_insert_key(m, open_at, {"method": "_open_window", "args": []})
	a.track_insert_key(m, close_at, {"method": "_close_window", "args": []})

	return a


func _make_swing() -> Animation:
	## A diagonal overhead chop, right to left.
	##
	## The strike leg is monotonic down (-Y) and forward (-Z) so the blade
	## never doubles back mid-cut, which reads as the animation playing in
	## reverse.
	##
	#   time   tip offset                       extra roll (deg)
	return _tip_path_anim(0.58, [
		[0.00, Vector3.ZERO,                      0.0],
		[0.12, Vector3(0.52, 0.52, 0.30),       -34.0],   # wind up over the shoulder
		[0.22, Vector3(0.38, 0.26, -0.10),      -12.0],   # start the cut
		[0.31, Vector3(-0.06, -0.20, -0.46),     22.0],   # through the target
		[0.40, Vector3(-0.52, -0.52, -0.58),     48.0],   # follow through
		[0.48, Vector3(-0.40, -0.40, -0.30),     30.0],   # settle
		[0.58, Vector3.ZERO,                      0.0],
	], 0.19, 0.40)


func _make_thrust() -> Animation:
	## A straight thrust - the sword chambered back at the hip, then driven
	## point-first down the centre line and retracted.
	##
	## Deliberately a different technique from the chop rather than a mirror
	## of it: shorter, tighter, and it reaches further forward.
	##
	## Unlike the chop, this one keyframes the GRIP directly. The tip-path
	## solver aims the blade at wherever the tip is going, which for a
	## straight thrust is almost dead ahead - so it leaves the sword in its
	## resting diagonal and merely slides it forward. That reads as shoving
	## the flat of the board at someone, not stabbing them. A thrust has to
	## square the blade up and point it at the target first.
	var a := _pos_rot_anim(0.46, false)

	# Aimed down the centre line and rolled well over so the board turns
	# toward its edge. Pointing a 30cm-wide keyboard flat-side-forward just
	# fills the screen with a slab; canting it is what makes the motion read
	# as a stab rather than a shove. Past about 70 degrees it lies fully
	# horizontal and reads as a lance, so it stops short of that.
	var aimed := Vector3(2.0, -3.0, 55.0)

	#   time   grip position                         rotation (deg)
	var keys := [
		[0.00, REST_POS,                               REST_ROT],
		[0.10, REST_POS + Vector3(0.10, 0.04, 0.26),   Vector3(-2, -14, 40)],  # chamber at the hip
		[0.16, REST_POS + Vector3(0.07, 0.03, 0.16),   Vector3(1, -8, 49)],    # line up the point
		[0.26, REST_POS + Vector3(-0.05, 0.02, -0.66), aimed],                 # drive it through
		[0.30, REST_POS + Vector3(-0.06, 0.02, -0.80), aimed + Vector3(1, 0, 3)],
		[0.38, REST_POS + Vector3(-0.01, 0.00, -0.26), Vector3(8, -16, 38)],   # retract
		[0.46, REST_POS,                               REST_ROT],
	]

	for k in keys:
		a.track_insert_key(0, k[0], k[1])
		a.track_insert_key(1, k[0], k[2])

	a.track_set_interpolation_type(0, Animation.INTERPOLATION_CUBIC)
	a.track_set_interpolation_type(1, Animation.INTERPOLATION_CUBIC)

	var m := a.add_track(Animation.TYPE_METHOD)
	a.track_set_path(m, ".")
	a.track_insert_key(m, 0.20, {"method": "_open_window", "args": []})
	a.track_insert_key(m, 0.32, {"method": "_close_window", "args": []})

	return a
