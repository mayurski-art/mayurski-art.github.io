extends Node

## Captures frames of a swing so the weapon can be checked visually
## without sitting in front of the editor.
## Run: Godot --script-from-scene, or attach to the test range temporarily.

const OUT_DIR := "user://shots"
const FRAMES := [0.0, 0.14, 0.22, 0.30, 0.38, 0.52]


func _ready() -> void:
	DirAccess.make_dir_recursive_absolute(OUT_DIR)
	_capture.call_deferred()


func _capture() -> void:
	var weapon := get_tree().get_first_node_in_group("melee_weapon")
	if weapon == null:
		weapon = get_node_or_null(
			"/root/TestRange/Player/Camera3D/WeaponHolder/KeyboardSword")

	# Let the renderer settle.
	for i in 10:
		await get_tree().process_frame

	await _shot("idle")

	if weapon and weapon.has_method("try_swing"):
		weapon.try_swing()
		var last := 0.0
		for t in FRAMES:
			await get_tree().create_timer(t - last).timeout
			last = t
			await RenderingServer.frame_post_draw
			await _shot("swing_%03d" % int(t * 1000))

	print("[screenshot] wrote to %s" % ProjectSettings.globalize_path(OUT_DIR))
	get_tree().quit()


func _shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	var path := "%s/%s.png" % [OUT_DIR, name]
	img.save_png(path)
	print("[screenshot] %s" % ProjectSettings.globalize_path(path))
