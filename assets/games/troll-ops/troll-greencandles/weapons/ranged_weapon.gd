class_name RangedWeapon
extends Node3D

## Base first-person ranged weapon.
##
## Fires a projectile scene from the Muzzle marker on trigger, with a
## semi/full-auto cooldown and a mag/reserve ammo pool.
##
## If the weapon has an AnimationPlayer with "aim_idle" / "fire" / "reload"
## clips, those drive the pose - raising into an aimed stance, punching the
## barrel forward on each shot, dipping to swap the tank on reload. If not,
## everything falls back to the old timer + procedural transform math, so a
## weapon works before anyone authors animations for it - the same
## contract MeleeWeapon uses for swings.

signal fired(muzzle_position: Vector3, muzzle_forward: Vector3)
signal reload_started
signal reload_finished
signal ammo_changed(in_mag: int, reserve: int)
signal dry_fire

@export_group("Fire mode")
@export var auto_fire: bool = false
@export var rounds_per_minute: float = 340.0

@export_group("Ammo")
@export var mag_size: int = 12
@export var reserve_max: int = 60
@export var reload_time: float = 3.0

@export_group("Damage")
@export var damage: float = 48.0
@export var muzzle_velocity: float = 26.0
## Gravity multiplier on the fired projectile; 0 = hitscan-flat travel.
@export var projectile_gravity_scale: float = 0.35

@export_group("Feel")
@export var recoil_kick: float = 0.06
@export var recoil_recover_speed: float = 8.0
@export var sway_amount: float = 0.012
@export var sway_speed: float = 6.0

@export_group("Animation")
## Clip played once on ready and looped between shots. Optional.
@export var aim_idle_animation: String = "aim_idle"
## Clip played on every shot. The projectile spawns at its call-method
## track's "_muzzle_release" mark, or immediately if the clip has none.
@export var fire_animation: String = "fire"
## Clip played across the whole reload. Scaled to fit reload_time.
@export var reload_animation: String = "reload"

@export var projectile_scene: PackedScene

@export_group("Aiming")
## How far the crosshair's aim ray reaches when nothing is hit. The
## projectile is aimed at this point (or whatever it actually hit first),
## not at the muzzle's own facing - the same "screen-center convergence"
## trick most FPS games use so what you see down the sights is genuinely
## where the shot goes, independent of exactly how the barrel is modeled.
@export var aim_range: float = 200.0
## Which physics layers the aim ray can hit. Defaults to world + damageable
## (see troll-melee-1's collision layer convention: 1 = world, 2 = targets).
@export_flags_3d_physics var aim_collision_mask: int = 0b11

## Camera the crosshair aims from. Auto-resolved to the nearest Camera3D
## ancestor if left unset, so a weapon works when simply parented under a
## player's camera without extra wiring - set explicitly if the aim
## camera isn't an ancestor.
var aim_camera: Camera3D = null

@onready var _muzzle: Marker3D = get_node_or_null("Muzzle")
@onready var _audio_fire: AudioStreamPlayer3D = get_node_or_null("FireAudio")
@onready var _audio_reload: AudioStreamPlayer3D = get_node_or_null("ReloadAudio")
@onready var _muzzle_light: OmniLight3D = get_node_or_null("Muzzle/MuzzleFlash")
@onready var _anim: AnimationPlayer = get_node_or_null("AnimationPlayer")

var _ammo_in_mag: int
var _ammo_reserve: int
var _fire_cooldown: float = 0.0
var _reloading: bool = false
var _rest_transform: Transform3D
var _sway_offset: Vector2 = Vector2.ZERO
var _recoil: float = 0.0
var _flash_t: float = 0.0


func _ready() -> void:
	_rest_transform = transform
	_ammo_in_mag = mag_size
	_ammo_reserve = reserve_max - mag_size
	if _muzzle_light:
		_muzzle_light.visible = false
	if _anim and _anim.has_animation(aim_idle_animation):
		_anim.play(aim_idle_animation)
		_anim.animation_finished.connect(_on_anim_finished)
	if aim_camera == null:
		aim_camera = _find_ancestor_camera()
	_emit_ammo()


func _find_ancestor_camera() -> Camera3D:
	var n: Node = get_parent()
	while n:
		if n is Camera3D:
			return n
		n = n.get_parent()
	return null


## Where the crosshair is actually pointing: a ray from the aim camera's
## screen center out to the first thing it hits, or aim_range away if it
## hits nothing. This is what the projectile targets - see aim_range.
func get_aim_point() -> Vector3:
	if aim_camera == null:
		var fallback := global_position - global_transform.basis.z * aim_range
		return fallback

	var vp := aim_camera.get_viewport()
	var center := vp.get_visible_rect().size * 0.5
	var from := aim_camera.project_ray_origin(center)
	var dir := aim_camera.project_ray_normal(center)
	var to := from + dir * aim_range

	var space := get_world_3d().direct_space_state
	var query := PhysicsRayQueryParameters3D.create(from, to)
	query.collision_mask = aim_collision_mask
	query.collide_with_areas = true
	var hit := space.intersect_ray(query)
	return hit.position if hit else to


func _process(delta: float) -> void:
	_fire_cooldown = maxf(0.0, _fire_cooldown - delta)
	_recoil = maxf(0.0, _recoil - recoil_recover_speed * delta)
	if not _anim:
		_apply_sway_and_recoil(delta)

	if _flash_t > 0.0:
		_flash_t = maxf(0.0, _flash_t - delta * 16.0)
		if _muzzle_light:
			_muzzle_light.visible = _flash_t > 0.0
			_muzzle_light.light_energy = _flash_t


## Call from the player on the fire input. Returns true if a shot fired.
func try_fire() -> bool:
	if _reloading or _fire_cooldown > 0.0:
		return false
	if _ammo_in_mag <= 0:
		if _audio_fire and _fire_cooldown <= 0.0:
			dry_fire.emit()
		return false

	_ammo_in_mag -= 1
	_fire_cooldown = 60.0 / maxf(1.0, rounds_per_minute)
	_recoil = minf(1.0, _recoil + recoil_kick)
	_flash_t = 1.0

	if _audio_fire and _audio_fire.stream:
		_audio_fire.pitch_scale = randf_range(0.95, 1.05)
		_audio_fire.play()

	if _anim and _anim.has_animation(fire_animation):
		_anim.stop()
		_anim.play(fire_animation)
		if not _animation_has_method_track(fire_animation):
			# No authored release mark - spawn immediately, same as the
			# no-animation-at-all path below.
			_spawn_projectile()
	else:
		_spawn_projectile()

	_emit_ammo()

	var forward := -global_transform.basis.z
	var origin := _muzzle.global_position if _muzzle else global_position
	fired.emit(origin, forward)
	return true


## Call from the player on the reload input. Returns true if a reload started.
func try_reload() -> bool:
	if _reloading or _ammo_reserve <= 0 or _ammo_in_mag >= mag_size:
		return false
	_reloading = true
	reload_started.emit()
	if _audio_reload and _audio_reload.stream:
		_audio_reload.play()

	if _anim and _anim.has_animation(reload_animation):
		_anim.stop()
		# Stretch the authored clip to whatever reload_time is currently
		# tuned to, so designers can retime the reload from the Inspector
		# without re-authoring the animation.
		var clip_len := _anim.get_animation(reload_animation).length
		_anim.speed_scale = clip_len / maxf(0.05, reload_time) if clip_len > 0.0 else 1.0
		_anim.play(reload_animation)

	await get_tree().create_timer(reload_time).timeout

	var need := mag_size - _ammo_in_mag
	var take := mini(need, _ammo_reserve)
	_ammo_in_mag += take
	_ammo_reserve -= take
	_reloading = false
	if _anim:
		_anim.speed_scale = 1.0
	_emit_ammo()
	reload_finished.emit()
	return true


func ammo_in_mag() -> int:
	return _ammo_in_mag


func ammo_reserve() -> int:
	return _ammo_reserve


func is_reloading() -> bool:
	return _reloading


func _emit_ammo() -> void:
	ammo_changed.emit(_ammo_in_mag, _ammo_reserve)


func _animation_has_method_track(anim_name: String) -> bool:
	var anim := _anim.get_animation(anim_name)
	if anim == null:
		return false
	for i in anim.get_track_count():
		if anim.track_get_type(i) == Animation.TYPE_METHOD:
			return true
	return false


## Called from a call-method track on the fire animation, at the frame the
## barrel/tip is actually pointed at the target. Falls back to firing
## immediately (in try_fire) when the clip has no such track.
func _muzzle_release() -> void:
	_spawn_projectile()


func _on_anim_finished(anim_name: String) -> void:
	if anim_name != aim_idle_animation and _anim and _anim.has_animation(aim_idle_animation):
		_anim.play(aim_idle_animation)


func _spawn_projectile() -> void:
	if projectile_scene == null or _muzzle == null:
		return
	var proj := projectile_scene.instantiate()
	# current_scene is only set once a scene is actually pushed as the
	# tree's main scene - a script-driven test tree that add_child()s a
	# scene directly (rather than change_scene_to_packed) leaves it null.
	# root is always valid, so fall back to that.
	var parent: Node = get_tree().current_scene if get_tree().current_scene else get_tree().root
	parent.add_child(proj)

	var muzzle_pos := _muzzle.global_position
	proj.global_transform = _muzzle.global_transform
	if proj.has_method("launch"):
		# Aim at wherever the crosshair actually points, not at the
		# muzzle's own local facing - the barrel's modeled angle and the
		# screen-center convergence point are two different things, and
		# the crosshair only means anything if the shot targets the
		# second one. See get_aim_point().
		var forward := (get_aim_point() - muzzle_pos).normalized()
		proj.launch(forward * muzzle_velocity, damage, projectile_gravity_scale, owner)


func _apply_sway_and_recoil(delta: float) -> void:
	var mouse := Input.get_last_mouse_velocity()
	var target := Vector2(
		clampf(-mouse.x * 0.00012, -1.0, 1.0),
		clampf(-mouse.y * 0.00012, -1.0, 1.0),
	)
	_sway_offset = _sway_offset.lerp(target, clampf(delta * sway_speed, 0.0, 1.0))

	transform.origin = _rest_transform.origin + Vector3(
		_sway_offset.x * sway_amount,
		_sway_offset.y * sway_amount + _recoil * 0.05,
		_recoil * 0.09,
	)
	rotation.x = _rest_transform.basis.get_euler().x - _recoil * 0.22
