class_name MeleeWeapon
extends Node3D

## Base first-person melee weapon.
##
## The swing is driven by an AnimationPlayer. Damage is NOT applied when the
## button is pressed - the animation opens a hit window partway through the
## arc via call-method tracks (or _open_window/_close_window called from
## code). That is what gives a swing weight instead of an instant hit.

signal hit_landed(body: Node3D, point: Vector3)
signal swing_started(anim_name: String)
signal swing_finished

@export_group("Damage")
@export var damage: float = 55.0
@export var knockback: float = 6.0
## Hits per swing. 1 = only the first body touched takes damage.
@export var max_targets_per_swing: int = 3

@export_group("Timing")
## Seconds between swings. Also the animation length if no anim is found.
@export var cooldown: float = 0.62
## Fraction of the swing where the blade is live. Used only when the
## animation has no call-method tracks of its own.
@export var window_open: float = 0.34
@export var window_close: float = 0.62

@export_group("Feel")
@export var swing_animations: Array[String] = ["swing_1", "swing_2"]
@export var idle_animation: String = "idle"
## Sway/bob amount as the player moves the camera.
@export var sway_amount: float = 0.014
@export var sway_speed: float = 7.0

@onready var _anim: AnimationPlayer = get_node_or_null("AnimationPlayer")
@onready var _hit_area: Area3D = get_node_or_null("HitArea")
@onready var _audio_swing: AudioStreamPlayer3D = get_node_or_null("SwingAudio")
@onready var _audio_impact: AudioStreamPlayer3D = get_node_or_null("ImpactAudio")

var _can_swing: bool = true
var _window_live: bool = false
var _already_hit: Array[Node3D] = []
var _swing_index: int = 0
var _rest_transform: Transform3D
var _sway_offset: Vector2 = Vector2.ZERO
var _window_timer: SceneTreeTimer = null


func _ready() -> void:
	_rest_transform = transform

	if _hit_area:
		_hit_area.monitoring = false
		_hit_area.body_entered.connect(_on_body_entered)
		# Areas can hit other areas too (hitboxes on characters).
		if not _hit_area.area_entered.is_connected(_on_area_entered):
			_hit_area.area_entered.connect(_on_area_entered)

	if _anim and _anim.has_animation(idle_animation):
		_anim.play(idle_animation)
		_anim.animation_finished.connect(_on_anim_finished)


func _process(delta: float) -> void:
	_apply_sway(delta)


## Call from the player when the attack button is pressed.
## Returns true if a swing actually started.
func try_swing() -> bool:
	if not _can_swing:
		return false
	_start_swing()
	return true


func _start_swing() -> void:
	_can_swing = false
	_already_hit.clear()

	var anim_name := ""
	if swing_animations.size() > 0:
		anim_name = swing_animations[_swing_index % swing_animations.size()]
		_swing_index += 1

	if _audio_swing and _audio_swing.stream:
		_audio_swing.pitch_scale = randf_range(0.94, 1.07)
		_audio_swing.play()

	swing_started.emit(anim_name)

	var length := cooldown
	if _anim and anim_name != "" and _anim.has_animation(anim_name):
		_anim.stop()
		_anim.play(anim_name)
		length = _anim.get_animation(anim_name).length
		# If the animation author added call-method tracks for the hit
		# window, they drive it. Otherwise fall back to timers.
		if not _animation_drives_window(anim_name):
			_schedule_window(length)
	else:
		# No animation at all - pure timer fallback so the weapon still works.
		_schedule_window(length)

	await get_tree().create_timer(maxf(length, cooldown)).timeout
	_can_swing = true
	swing_finished.emit()


func _animation_drives_window(anim_name: String) -> bool:
	var anim := _anim.get_animation(anim_name)
	if anim == null:
		return false
	for i in anim.get_track_count():
		if anim.track_get_type(i) == Animation.TYPE_METHOD:
			return true
	return false


func _schedule_window(length: float) -> void:
	var open_at := length * window_open
	var close_at := length * window_close
	get_tree().create_timer(open_at).timeout.connect(_open_window)
	get_tree().create_timer(close_at).timeout.connect(_close_window)


## Called from an animation call-method track, or by the timer fallback.
func _open_window() -> void:
	_window_live = true
	if _hit_area:
		_hit_area.monitoring = true
		# Catch bodies already overlapping when the window opens.
		for body in _hit_area.get_overlapping_bodies():
			_on_body_entered(body)


func _close_window() -> void:
	_window_live = false
	if _hit_area:
		_hit_area.monitoring = false


func _on_body_entered(body: Node3D) -> void:
	_register_hit(body)


func _on_area_entered(area: Area3D) -> void:
	# Prefer the owning character over the raw hitbox node.
	var target := area.get_parent() as Node3D
	_register_hit(target if target else area)


func _register_hit(target: Node3D) -> void:
	if not _window_live or target == null:
		return
	if target in _already_hit:
		return
	if _already_hit.size() >= max_targets_per_swing:
		return
	if target == owner or target == get_parent():
		return

	_already_hit.append(target)

	var point := _hit_area.global_position if _hit_area else global_position

	if target.has_method("take_damage"):
		var dir := (target.global_position - global_position).normalized()
		target.take_damage(damage, dir * knockback, point)

	if _audio_impact and _audio_impact.stream:
		_audio_impact.pitch_scale = randf_range(0.9, 1.12)
		_audio_impact.play()

	hit_landed.emit(target, point)


func _apply_sway(delta: float) -> void:
	var mouse := Input.get_last_mouse_velocity()
	var target := Vector2(
		clampf(-mouse.x * 0.00012, -1.0, 1.0),
		clampf(-mouse.y * 0.00012, -1.0, 1.0),
	)
	_sway_offset = _sway_offset.lerp(target, clampf(delta * sway_speed, 0.0, 1.0))

	# Sway is layered on top of whatever the animation is doing, so it
	# only offsets when no swing animation is currently playing.
	if _anim and _anim.is_playing() and _anim.current_animation != idle_animation:
		return

	transform.origin = _rest_transform.origin + Vector3(
		_sway_offset.x * sway_amount,
		_sway_offset.y * sway_amount,
		0.0,
	)


func _on_anim_finished(anim_name: String) -> void:
	_close_window()
	if _anim and _anim.has_animation(idle_animation) and anim_name != idle_animation:
		_anim.play(idle_animation)
