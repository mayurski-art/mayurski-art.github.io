extends SceneTree

## Measures where the blade actually travels during each attack.
##
## An attack that plays in reverse still "runs" fine - it animates, the hit
## window opens, the melee tests pass - it just looks wrong. So assert on
## the motion itself.
##
## The two attacks are different techniques, so they are held to different
## rules: the chop must fall and cross the view, the thrust must drive
## straight down the centre line and out-reach the chop.

var _failures: Array[String] = []


func _init() -> void:
	_run.call_deferred()


func _ok(label: String, cond: bool, detail: String = "") -> void:
	print("  %s  %s%s" % ["PASS" if cond else "FAIL", label,
		("" if cond or detail == "" else "  -> " + detail)])
	if not cond:
		_failures.append(label)


## Samples the blade tip's local position over the course of an animation.
func _sample(weapon: Node3D, anim: AnimationPlayer, name: String,
		tip_local: Vector3) -> Array:
	var a: Animation = anim.get_animation(name)
	var out: Array = []
	var steps := 40
	for i in steps + 1:
		var t := (float(i) / steps) * a.length
		anim.play(name)
		anim.seek(t, true)
		await process_frame
		out.append({
			"t": t,
			"tip": weapon.transform * tip_local,
		})
	return out


## Net travel along one axis across a time slice: end minus start.
## Signed, so the sign says which way the blade swept.
func _travel_axis(samples: Array, axis: String, from_t: float, to_t: float) -> float:
	var first := INF
	var last := INF
	for p in samples:
		if p["t"] < from_t or p["t"] > to_t:
			continue
		var v: Vector3 = p["tip"]
		var c: float = v.x if axis == "x" else (v.y if axis == "y" else v.z)
		if first == INF:
			first = c
		last = c
	if first == INF:
		return 0.0
	return last - first


func _run() -> void:
	print("\n=== swing arc geometry ===\n")

	var scene: PackedScene = load("res://player/test_range.tscn")
	var world := scene.instantiate()
	root.add_child(world)
	await process_frame
	await process_frame

	var weapon := world.get_node_or_null(
		"Player/Camera3D/WeaponHolder/KeyboardSword") as Node3D
	var anim := weapon.get_node_or_null("AnimationPlayer") as AnimationPlayer
	if weapon == null or anim == null:
		_ok("weapon + AnimationPlayer exist", false)
		_finish()
		return

	# A point out along the blade, in the weapon's local space.
	var tip_local := Vector3(0, 0, -0.9)

	var arcs := {}
	for name in ["swing_1", "thrust"]:
		if not anim.has_animation(name):
			_ok("%s exists" % name, false)
			continue
		arcs[name] = await _sample(weapon, anim, name, tip_local)

	# Shared rule for every attack: the blade must end up further FORWARD
	# than it started. Anything that only ever retreats is playing in
	# reverse, which is the bug this file exists to catch.
	for name in arcs.keys():
		var s: Array = arcs[name]
		var rest: Vector3 = s[0]["tip"]
		var nearest := rest.z
		for p in s:
			nearest = minf(nearest, (p["tip"] as Vector3).z)
		_ok("%s: reaches forward of the resting pose" % name,
			nearest < rest.z - 0.1, "nearest=%.3f rest=%.3f" % [nearest, rest.z])

	# --- the chop: down and across, right to left ---
	if arcs.has("swing_1"):
		var s: Array = arcs["swing_1"]
		var rest: Vector3 = s[0]["tip"]

		var dy := _travel_axis(s, "y", 0.22, 0.40)
		_ok("chop: blade travels DOWN through the strike", dy < -0.05,
			"dy=%.3f" % dy)

		var dz := _travel_axis(s, "z", 0.22, 0.40)
		_ok("chop: blade travels FORWARD through the strike", dz < 0.0,
			"dz=%.3f" % dz)

		var lowest := rest.y
		for p in s:
			lowest = minf(lowest, (p["tip"] as Vector3).y)
		_ok("chop: dips below the resting pose", lowest < rest.y - 0.15,
			"lowest=%.3f rest=%.3f" % [lowest, rest.y])

		# It is a diagonal cut, so it has to actually cross the view.
		var dx := _travel_axis(s, "x", 0.10, 0.45)
		_ok("chop: sweeps right to left", dx < -0.4, "dx=%+.3f" % dx)

	# --- the thrust: straight down the centre line ---
	if arcs.has("thrust"):
		var s: Array = arcs["thrust"]
		var rest: Vector3 = s[0]["tip"]

		# Almost all of the travel should be forward, not sideways or down -
		# otherwise it is just a second chop.
		var dz := _travel_axis(s, "z", 0.16, 0.30)
		_ok("thrust: drives FORWARD hard", dz < -0.6, "dz=%.3f" % dz)

		var reach := rest.z
		for p in s:
			reach = minf(reach, (p["tip"] as Vector3).z)
		_ok("thrust: out-reaches the chop",
			arcs.has("swing_1") and reach < _min_axis(arcs["swing_1"], "z"),
			"thrust reach=%.3f" % reach)

		var dx := _travel_axis(s, "x", 0.10, 0.38)
		var dy := _travel_axis(s, "y", 0.10, 0.38)
		_ok("thrust: stays on the centre line", absf(dx) < 0.35,
			"dx=%+.3f" % dx)
		_ok("thrust: does not chop downward", absf(dy) < 0.35,
			"dy=%+.3f" % dy)

		# It must come back, or the sword is left hanging in mid-air.
		var last: Vector3 = s[-1]["tip"]
		_ok("thrust: retracts to rest", last.distance_to(rest) < 0.05,
			"end offset=%.3f" % last.distance_to(rest))

	_finish()


## Smallest value of one axis across the whole arc.
func _min_axis(samples: Array, axis: String) -> float:
	var lo := INF
	for p in samples:
		var v: Vector3 = p["tip"]
		lo = minf(lo, v.x if axis == "x" else (v.y if axis == "y" else v.z))
	return lo


func _finish() -> void:
	print("\n=== %d failure(s) ===" % _failures.size())
	for f in _failures:
		print("  - " + f)
	if _failures.is_empty():
		print("ALL GREEN")
	quit(1 if _failures.size() > 0 else 0)
