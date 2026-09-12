extends CharacterBody3D

## Minimal first-person controller, just enough to test Green Candles feel.

@export var move_speed: float = 5.2
@export var sprint_speed: float = 7.8
@export var jump_velocity: float = 4.6
@export var mouse_sensitivity: float = 0.0022

const ViewmodelArmsScene := preload("res://player/viewmodel_arms.gd")

@onready var _camera: Camera3D = $Camera3D
@onready var _weapon: RangedWeapon = $Camera3D/WeaponHolder/GreenCandles
@onready var _ammo_label: Label = get_node_or_null("../HUD/AmmoLabel")

var _pitch: float = 0.0


func _ready() -> void:
	# Layer/mask 1 is the world. Set here rather than left to the scene
	# file: opening a hand-written .tscn in the editor makes Godot rewrite
	# it and silently drop properties, and losing the mask drops the player
	# through the floor.
	collision_layer = 1
	collision_mask = 1

	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	if _weapon:
		_weapon.fired.connect(_on_fired)
		_weapon.ammo_changed.connect(_on_ammo_changed)
		_on_ammo_changed(_weapon.ammo_in_mag(), _weapon.ammo_reserve())

	# Trollface viewmodel arms, added in code rather than saved into the
	# scene for the same reason the collision layers are set here: it
	# survives editor re-saves of test_range.tscn intact.
	var arms := ViewmodelArmsScene.new()
	arms.name = "ViewmodelArms"
	_camera.add_child(arms)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		rotate_y(-event.relative.x * mouse_sensitivity)
		_pitch = clampf(_pitch - event.relative.y * mouse_sensitivity,
			deg_to_rad(-89.0), deg_to_rad(89.0))
		_camera.rotation.x = _pitch

	if event.is_action_pressed("ui_cancel"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

	if event is InputEventMouseButton and event.pressed:
		if Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
		elif event.button_index == MOUSE_BUTTON_LEFT and _weapon:
			_weapon.try_fire()

	# 'R' has no default action map entry in a bare project; check the raw
	# key so reload works without editing project input settings.
	if event is InputEventKey and event.pressed and event.keycode == KEY_R and _weapon:
		_weapon.try_reload()


func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity += get_gravity() * delta

	if Input.is_action_just_pressed("ui_accept") and is_on_floor():
		velocity.y = jump_velocity

	var input_dir := Vector2(
		Input.get_axis("ui_left", "ui_right"),
		Input.get_axis("ui_up", "ui_down"),
	)
	var dir := (transform.basis * Vector3(input_dir.x, 0, input_dir.y)).normalized()
	var speed := sprint_speed if Input.is_key_pressed(KEY_SHIFT) else move_speed

	if dir:
		velocity.x = dir.x * speed
		velocity.z = dir.z * speed
	else:
		velocity.x = move_toward(velocity.x, 0.0, speed)
		velocity.z = move_toward(velocity.z, 0.0, speed)

	move_and_slide()


func _on_fired(_muzzle_position: Vector3, _muzzle_forward: Vector3) -> void:
	print("[greencandles] fired")


func _on_ammo_changed(in_mag: int, reserve: int) -> void:
	if _ammo_label:
		_ammo_label.text = "%d / %d" % [in_mag, reserve]
