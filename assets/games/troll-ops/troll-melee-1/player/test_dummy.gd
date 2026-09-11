extends StaticBody3D

## Punching bag. Implements take_damage(), which is the contract
## MeleeWeapon looks for on anything it hits.

@export var max_health: float = 200.0

@onready var _mesh: MeshInstance3D = $MeshInstance3D
@onready var _label: Label3D = $Label3D

var _health: float
var _base_pos: Vector3
var _flash: float = 0.0
var _wobble: Vector3 = Vector3.ZERO


func _ready() -> void:
	_health = max_health
	_base_pos = position
	_update_label()


func take_damage(amount: float, impulse: Vector3 = Vector3.ZERO,
		_point: Vector3 = Vector3.ZERO) -> void:
	_health = maxf(_health - amount, 0.0)
	_flash = 1.0
	_wobble = impulse * 0.03
	_update_label()

	if _health <= 0.0:
		_label.text = "DOWN"
		_label.modulate = Color(1.0, 0.3, 0.3)
		await get_tree().create_timer(1.4).timeout
		_health = max_health
		_label.modulate = Color.WHITE
		_update_label()


func _process(delta: float) -> void:
	# Hit flash.
	if _flash > 0.0:
		_flash = maxf(_flash - delta * 4.0, 0.0)
		var mat := _mesh.get_surface_override_material(0)
		if mat is StandardMaterial3D:
			mat.emission_enabled = true
			mat.emission = Color(1.0, 0.25, 0.2)
			mat.emission_energy_multiplier = _flash * 2.5

	# Spring back from the knockback nudge.
	_wobble = _wobble.lerp(Vector3.ZERO, clampf(delta * 6.0, 0.0, 1.0))
	position = _base_pos + _wobble


func _update_label() -> void:
	_label.text = "%d / %d" % [int(_health), int(max_health)]
