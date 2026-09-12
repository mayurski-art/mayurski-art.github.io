extends Area3D

## Generic fired projectile. RangedWeapon calls launch() right after
## instancing it; everything else is self-contained so any gun can reuse
## this one scene.

@export var life_seconds: float = 4.0
@export var trail_color: Color = Color(0.31, 0.9, 0.29)

var _velocity: Vector3 = Vector3.ZERO
var _gravity_scale: float = 0.0
var _damage: float = 0.0
var _shooter: Node = null
var _age: float = 0.0
var _already_hit: bool = false

@onready var _mesh: MeshInstance3D = get_node_or_null("Mesh")


func _ready() -> void:
	monitoring = true
	body_entered.connect(_on_body_entered)
	area_entered.connect(_on_area_entered)


func launch(velocity: Vector3, damage: float, gravity_scale: float, shooter: Node) -> void:
	_velocity = velocity
	_damage = damage
	_gravity_scale = gravity_scale
	_shooter = shooter
	look_at(global_position + velocity, Vector3.UP)


func _physics_process(delta: float) -> void:
	_age += delta
	if _age > life_seconds:
		queue_free()
		return

	_velocity += Vector3.DOWN * 9.8 * _gravity_scale * delta
	global_position += _velocity * delta
	if _velocity.length_squared() > 0.001:
		look_at(global_position + _velocity, Vector3.UP)


func _on_body_entered(body: Node3D) -> void:
	_register_hit(body)


func _on_area_entered(area: Area3D) -> void:
	var target := area.get_parent() as Node3D
	_register_hit(target if target else area)


func _register_hit(target: Node3D) -> void:
	if _already_hit or target == null or target == _shooter:
		return
	_already_hit = true

	if target.has_method("take_damage"):
		var dir := _velocity.normalized()
		target.take_damage(_damage, dir * 4.0, global_position)

	queue_free()
