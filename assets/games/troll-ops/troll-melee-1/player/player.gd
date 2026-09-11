extends CharacterBody3D

## Minimal first-person controller, just enough to test melee feel.

@export var move_speed: float = 5.2
@export var sprint_speed: float = 7.8
@export var jump_velocity: float = 4.6
@export var mouse_sensitivity: float = 0.0022

@onready var _camera: Camera3D = $Camera3D
@onready var _weapon: MeleeWeapon = $Camera3D/WeaponHolder/KeyboardSword

var _pitch: float = 0.0


func _ready() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	if _weapon:
		_weapon.hit_landed.connect(_on_hit_landed)


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

	move_and_slide()


func _on_hit_landed(body: Node3D, point: Vector3) -> void:
	print("[melee] hit %s at %s" % [body.name, point])
