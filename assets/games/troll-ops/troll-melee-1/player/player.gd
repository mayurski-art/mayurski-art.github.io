extends CharacterBody3D

## Minimal first-person controller, just enough to test melee feel.

@export var move_speed: float = 5.2
@export var sprint_speed: float = 7.8
@export var jump_velocity: float = 4.6
@export var mouse_sensitivity: float = 0.0022

const ViewmodelArmsScene := preload("res://player/viewmodel_arms.gd")

@onready var _camera: Camera3D = $Camera3D
@onready var _weapon: MeleeWeapon = $Camera3D/WeaponHolder/KeyboardSword

var _pitch: float = 0.0
var _viewmodel_arms: ViewmodelArms


func _ready() -> void:
	# Layer/mask 1 is the world. Set here rather than left to the scene
	# file: opening a hand-written .tscn in the editor makes Godot rewrite
	# it and silently drop properties, and losing the mask drops the player
	# through the floor.
	collision_layer = 1
	collision_mask = 1

	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	if _weapon:
		_weapon.hit_landed.connect(_on_hit_landed)

	# Trollface viewmodel arms, added in code rather than saved into the
	# scene for the same reason the collision layers are set here: it
	# survives editor re-saves of test_range.tscn intact.
	_viewmodel_arms = ViewmodelArmsScene.new()
	_viewmodel_arms.name = "ViewmodelArms"
	_camera.add_child(_viewmodel_arms)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		rotate_y(-event.relative.x * mouse_sensitivity)
		_pitch = clampf(_pitch - event.relative.y * mouse_sensitivity,
			deg_to_rad(-89.0), deg_to_rad(89.0))
		_camera.rotation.x = _pitch

	if event.is_action_pressed("ui_cancel"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

	# Left click captures the mouse again, then swings.
	if event is InputEventMouseButton and event.pressed \
			and event.button_index == MOUSE_BUTTON_LEFT:
		if Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
		elif _weapon:
			_weapon.try_swing()


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

	# Captured before move_and_slide() clamps velocity.y on impact - this
	# is the actual speed the body was falling at the moment it lands,
	# which is what the viewmodel's landing dip needs to scale against.
	var fall_speed := -velocity.y

	move_and_slide()

	if _viewmodel_arms:
		var horizontal_speed := Vector2(velocity.x, velocity.z).length()
		_viewmodel_arms.apply_motion(delta, horizontal_speed, is_on_floor(), fall_speed)


func _on_hit_landed(body: Node3D, point: Vector3) -> void:
	print("[melee] hit %s at %s" % [body.name, point])
