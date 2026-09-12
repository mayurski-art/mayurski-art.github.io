extends SceneTree

## Headless smoke test for the melee system.
## Run: Godot --headless --script res://tools/test_melee.gd

var _failures: Array[String] = []
var _hits: Array = []


func _init() -> void:
	_run.call_deferred()


func _ok(label: String, condition: bool, detail: String = "") -> void:
	if condition:
		print("  PASS  %s" % label)
	else:
		var msg := "  FAIL  %s%s" % [label, ("  -> " + detail) if detail else ""]
		print(msg)
		_failures.append(label)


func _run() -> void:
	print("\n=== melee smoke test ===\n")

	var scene: PackedScene = load("res://player/test_range.tscn")
	_ok("test_range.tscn loads", scene != null)
	if scene == null:
		_finish()
		return

	var world := scene.instantiate()
	root.add_child(world)
	await process_frame
	await process_frame

	var weapon := world.get_node_or_null(
		"Player/Camera3D/WeaponHolder/KeyboardSword") as MeleeWeapon
	_ok("weapon instantiates as MeleeWeapon", weapon != null)
	if weapon == null:
		_finish()
		return

	# --- structure ---
	var anim := weapon.get_node_or_null("AnimationPlayer") as AnimationPlayer
	_ok("AnimationPlayer exists", anim != null)
	if anim:
		_ok("idle animation built", anim.has_animation("idle"))
		_ok("swing_1 animation built", anim.has_animation("swing_1"))
		_ok("thrust animation built", anim.has_animation("thrust"))
		_ok("mirrored swing_2 is gone", not anim.has_animation("swing_2"))

		var sw: Animation = anim.get_animation("swing_1")
		var method_tracks := 0
		for i in sw.get_track_count():
			if sw.track_get_type(i) == Animation.TYPE_METHOD:
				method_tracks += 1
		_ok("swing has a hit-window method track", method_tracks > 0,
			"found %d" % method_tracks)

	var hit_area := weapon.get_node_or_null("HitArea") as Area3D
	_ok("HitArea exists", hit_area != null)
	if hit_area:
		_ok("HitArea starts disabled", not hit_area.monitoring)
		_ok("HitArea masks the enemy layer", hit_area.collision_mask == 2,
			"mask=%d" % hit_area.collision_mask)

	var dummy := world.get_node_or_null("Dummy1")
	_ok("dummy exists", dummy != null)
	_ok("dummy implements take_damage", dummy and dummy.has_method("take_damage"))

	weapon.hit_landed.connect(func(b, p): _hits.append([b.name, p]))

	# --- swing lifecycle ---
	var started := weapon.try_swing()
	_ok("try_swing() starts a swing", started)

	var blocked := weapon.try_swing()
	_ok("second swing blocked during cooldown", not blocked)

	# Step through the swing and watch the hit window open and close.
	#
	# Track REAL elapsed time, not a frame count times 1/60. Headless runs
	# nowhere near 60fps, so counting frames exits the loop long before the
	# animation has finished and the window has had a chance to close.
	var saw_open := false
	var started_at := Time.get_ticks_msec()
	while Time.get_ticks_msec() - started_at < 900:
		await process_frame
		if hit_area and hit_area.monitoring:
			saw_open = true
	_ok("hit window opened mid-swing", saw_open)
	_ok("hit window closed after swing", hit_area and not hit_area.monitoring)

	# --- cooldown recovery ---
	await create_timer(0.4).timeout
	_ok("can swing again after cooldown", weapon.try_swing())

	# --- direct damage contract ---
	if dummy:
		var before: float = dummy._health
		dummy.take_damage(55.0, Vector3.FORWARD * 6.0, Vector3.ZERO)
		await process_frame
		_ok("take_damage reduces health",
			dummy._health < before,
			"%s -> %s" % [before, dummy._health])

	# --- no double-hit within one swing ---
	if dummy:
		weapon._already_hit.clear()
		weapon._window_live = true
		weapon._register_hit(dummy)
		var after_first: float = dummy._health
		weapon._register_hit(dummy)
		await process_frame
		_ok("same target can't be hit twice in one swing",
			is_equal_approx(dummy._health, after_first),
			"health moved to %s" % dummy._health)
		weapon._window_live = false

	_finish()


func _finish() -> void:
	print("\n=== %d failure(s) ===" % _failures.size())
	for f in _failures:
		print("  - " + f)
	if _failures.is_empty():
		print("ALL GREEN")
	quit(1 if _failures.size() > 0 else 0)
