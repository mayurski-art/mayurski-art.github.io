extends SceneTree

## Headless smoke test for Green Candles.
## Run: Godot --headless --script res://tools/test_green_candles.gd

var _failures: Array[String] = []
var _fired_events: Array = []


func _init() -> void:
	_run.call_deferred()


func _ok(label: String, condition: bool, detail: String = "") -> void:
	if condition:
		print("  PASS  %s" % label)
	else:
		var msg := "  FAIL  %s%s" % [label, ("  -> " + detail) if detail else ""]
		print(msg)
		_failures.append(label)


## create_timer()'s timeout and AnimationPlayer's per-frame advance don't
## reliably track each other under headless "run as fast as possible"
## framerates - a timer for exactly an animation's length can fire before
## the animation has actually finished advancing that far (observed: a
## 0.37s timer resolving while the animation had only reached 0.27s of
## playback). Polling real elapsed wall-clock time via Time.get_ticks_msec
## alongside actual process_frame awaits (the same fix test_melee.gd uses
## for its hit-window timing) is what actually keeps this in sync.
func _wait_seconds(seconds: float) -> void:
	var started := Time.get_ticks_msec()
	while Time.get_ticks_msec() - started < int(seconds * 1000):
		await process_frame


func _run() -> void:
	print("\n=== green candles smoke test ===\n")

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
		"Player/Camera3D/WeaponHolder/GreenCandles") as RangedWeapon
	_ok("weapon instantiates as RangedWeapon", weapon != null)
	if weapon == null:
		_finish()
		return

	# --- structure ---
	var muzzle := weapon.get_node_or_null("Muzzle") as Marker3D
	_ok("Muzzle marker exists", muzzle != null)

	var model := weapon.get_node_or_null("Model") as Node3D
	_ok("Model node exists", model != null)
	if model:
		_ok("model has a mesh child", model.get_child_count() > 0)

	_ok("projectile_scene is wired", weapon.projectile_scene != null)

	# --- model orientation: held like a rifle, not standing upright ---
	# The barrel/muzzle should extend away from the player (-Z-ish, and
	# further from the origin than the grip), not stack straight up
	# (+Y) - the original bug this session fixed. Checking the actual
	# Muzzle marker position is a real regression guard, not just eyeballing
	# a screenshot each time.
	if muzzle:
		var local_muzzle: Vector3 = weapon.to_local(muzzle.global_position)
		_ok("muzzle sits forward of the grip (-Z), not stacked upward (+Y)",
			absf(local_muzzle.z) > absf(local_muzzle.y),
			"local muzzle offset = %s" % local_muzzle)

	# --- camera-raycast aim accuracy ---
	# The crosshair should be the true point of impact, not wherever the
	# barrel's own modeled angle happens to point - see get_aim_point().
	var cam := world.get_node_or_null("Player/Camera3D") as Camera3D
	_ok("aim_camera auto-resolved to the player's Camera3D", weapon.aim_camera == cam)
	if cam:
		var aim_point := weapon.get_aim_point()
		var to_dummy: Vector3 = (world.get_node("Dummy1").global_position - cam.global_position)
		var cam_forward := -cam.global_transform.basis.z
		# Dummy1 sits roughly on the camera's forward axis (see
		# test_range.tscn); the aim point from screen-center should land
		# within a tight cone of that same forward direction.
		var angle := cam_forward.normalized().angle_to((aim_point - cam.global_position).normalized())
		_ok("get_aim_point() points down the camera's forward axis",
			angle < deg_to_rad(5.0), "angle=%.2f deg" % rad_to_deg(angle))
		_ok("get_aim_point() is independent of the muzzle's own facing",
			not aim_point.is_equal_approx(muzzle.global_position - muzzle.global_transform.basis.z * weapon.aim_range))

	# --- animation ---
	var anim := weapon.get_node_or_null("AnimationPlayer") as AnimationPlayer
	_ok("AnimationPlayer exists", anim != null)
	if anim:
		_ok("aim_idle animation built", anim.has_animation(weapon.aim_idle_animation))
		_ok("fire animation built", anim.has_animation(weapon.fire_animation))
		_ok("reload animation built", anim.has_animation(weapon.reload_animation))
		_ok("weapon starts in the aim_idle pose",
			anim.current_animation == weapon.aim_idle_animation,
			"current=%s" % anim.current_animation)

		var fire_anim: Animation = anim.get_animation(weapon.fire_animation)
		var method_tracks := 0
		for i in fire_anim.get_track_count():
			if fire_anim.track_get_type(i) == Animation.TYPE_METHOD:
				method_tracks += 1
		_ok("fire clip has a muzzle-release method track", method_tracks > 0,
			"found %d" % method_tracks)

	var dummy := world.get_node_or_null("Dummy1")
	_ok("dummy exists", dummy != null)
	_ok("dummy implements take_damage", dummy and dummy.has_method("take_damage"))

	weapon.fired.connect(func(pos, fwd): _fired_events.append([pos, fwd]))

	# --- ammo lifecycle ---
	_ok("starts with a full mag", weapon.ammo_in_mag() == weapon.mag_size,
		"in_mag=%d mag_size=%d" % [weapon.ammo_in_mag(), weapon.mag_size])
	_ok("reserve starts at reserve_max - mag_size",
		weapon.ammo_reserve() == weapon.reserve_max - weapon.mag_size)

	# --- fire lifecycle ---
	var fired := weapon.try_fire()
	_ok("try_fire() fires when ready", fired)
	_ok("fired signal emitted", _fired_events.size() == 1)
	_ok("ammo_in_mag decremented", weapon.ammo_in_mag() == weapon.mag_size - 1)
	if anim:
		_ok("fire clip plays on shot",
			anim.current_animation == weapon.fire_animation,
			"current=%s" % anim.current_animation)

	var blocked := weapon.try_fire()
	_ok("second shot blocked during fire cooldown", not blocked)

	# The fire clip can outlast the RPM cooldown (a slow, weighty punch on
	# a semi-auto weapon), so check the animation settles back to aim_idle
	# on its own timeline before moving on to the cooldown/RPM checks.
	if anim:
		var fire_len := anim.get_animation(weapon.fire_animation).length
		await _wait_seconds(fire_len + 0.1)
		_ok("weapon returns to aim_idle after firing",
			anim.current_animation == weapon.aim_idle_animation,
			"current=%s" % anim.current_animation)

	# Wait out the fire cooldown (real elapsed time - headless runs far
	# from 60fps so a frame count is not a reliable proxy for seconds).
	var cooldown_s: float = 60.0 / weapon.rounds_per_minute
	await _wait_seconds(cooldown_s + 0.05)
	_ok("can fire again after cooldown", weapon.try_fire())

	# --- empty mag behavior ---
	while weapon.ammo_in_mag() > 0:
		weapon.try_fire()
		await _wait_seconds(cooldown_s + 0.02)
	_ok("mag empties out", weapon.ammo_in_mag() == 0)
	var dry := weapon.try_fire()
	_ok("try_fire() refuses to fire with an empty mag", not dry)

	# --- reload lifecycle ---
	var cell := weapon.get_node_or_null("Model/CellSeated") as Node3D
	_ok("fuel cell node (CellSeated) exists", cell != null)
	var cell_pos_before_reload: Vector3 = cell.position if cell else Vector3.ZERO

	# try_reload() is a coroutine that only returns once the whole reload
	# finishes - awaiting it directly would skip past the mid-reload state
	# entirely, so call it unawaited (GDScript still runs it synchronously
	# up to its first internal await) and check the live state separately.
	var reserve_before := weapon.ammo_reserve()
	weapon.try_reload()
	_ok("is_reloading() true right after try_reload()", weapon.is_reloading())
	if anim:
		_ok("reload clip plays on reload",
			anim.current_animation == weapon.reload_animation,
			"current=%s" % anim.current_animation)

	# Partway through the reload, the cell should have visibly left its
	# seated position (ejected) - this is the actual "the fuel cell comes
	# off and gets reinserted" behavior, not just a timer + ammo count.
	await _wait_seconds(weapon.reload_time * 0.3)
	if cell:
		_ok("fuel cell moves during reload (detach/reinsert, not just a timer)",
			not cell.position.is_equal_approx(cell_pos_before_reload),
			"pos=%s (was %s)" % [cell.position, cell_pos_before_reload])

	await _wait_seconds(weapon.reload_time * 0.7 + 0.15)
	_ok("reload finishes", not weapon.is_reloading())
	_ok("mag refilled from reserve",
		weapon.ammo_in_mag() == mini(weapon.mag_size, reserve_before),
		"in_mag=%d" % weapon.ammo_in_mag())
	if anim:
		_ok("weapon returns to aim_idle after reload",
			anim.current_animation == weapon.aim_idle_animation,
			"current=%s" % anim.current_animation)
	if cell:
		_ok("fuel cell reseated after reload completes",
			cell.position.is_equal_approx(cell_pos_before_reload),
			"pos=%s (expected %s)" % [cell.position, cell_pos_before_reload])
		_ok("fuel cell visible again after reseating", cell.visible)

	# --- direct damage contract (mirrors the melee test) ---
	if dummy:
		var before: float = dummy._health
		dummy.take_damage(weapon.damage, Vector3.FORWARD * 4.0, Vector3.ZERO)
		await process_frame
		_ok("take_damage reduces health",
			dummy._health < before,
			"%s -> %s" % [before, dummy._health])

	_finish()


func _finish() -> void:
	print("\n=== %d failure(s) ===" % _failures.size())
	for f in _failures:
		print("  - " + f)
	if _failures.is_empty():
		print("ALL GREEN")
	quit(1 if _failures.size() > 0 else 0)
