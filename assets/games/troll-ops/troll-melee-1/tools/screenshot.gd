extends Node

## Captures frames of each attack so the motion can be checked visually
## without sitting in front of the editor.

const OUT_DIR := "user://shots"
const CLIPS := {
	"chop": [0.0, 0.12, 0.22, 0.31, 0.40, 0.48],
	"thrust": [0.0, 0.10, 0.16, 0.26, 0.30, 0.38],
}
const ANIMS := {"chop": "swing_1", "thrust": "thrust"}


func _ready() -> void:
	DirAccess.make_dir_recursive_absolute(OUT_DIR)
	_capture.call_deferred()


func _capture() -> void:
	var weapon := get_node_or_null(
		"/root/TestRange/Player/Camera3D/WeaponHolder/KeyboardSword") as Node3D
	var anim := weapon.get_node_or_null("AnimationPlayer") as AnimationPlayer

	for i in 10:
		await get_tree().process_frame

	for label in CLIPS.keys():
		var name: String = ANIMS[label]
		if anim == null or not anim.has_animation(name):
			continue
		for t in CLIPS[label]:
			# The weapon auto-plays "idle" on ready, and its position and
			# rotation tracks overwrite a seeked pose on the next frame.
			# Pausing pins the frame we actually asked for.
			anim.play(name)
			anim.seek(t, true)
			anim.pause()
			await get_tree().process_frame
			await RenderingServer.frame_post_draw
			var img := get_viewport().get_texture().get_image()
			var path := "%s/%s_%03d.png" % [OUT_DIR, label, int(t * 1000)]
			img.save_png(path)
			print("[screenshot] %s" % ProjectSettings.globalize_path(path))

	get_tree().quit()
