extends Node

## Captures the weapon's rest pose so the model can be checked visually
## without sitting in front of the editor.

const OUT_DIR := "user://shots"


func _ready() -> void:
	DirAccess.make_dir_recursive_absolute(OUT_DIR)
	_capture.call_deferred()


func _capture() -> void:
	var cam := get_viewport().get_camera_3d()
	if cam and cam.get_meta("look_at_origin", false):
		cam.look_at(Vector3.ZERO, Vector3.UP)

	for i in 10:
		await get_tree().process_frame

	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	var path := "%s/green_candles_rest.png" % OUT_DIR
	img.save_png(path)
	print("[screenshot] %s" % ProjectSettings.globalize_path(path))

	get_tree().quit()
