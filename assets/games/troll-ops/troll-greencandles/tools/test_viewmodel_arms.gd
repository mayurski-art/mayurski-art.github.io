extends SceneTree

## Headless check that ViewmodelArms actually finds the skeleton, hides the
## head/legs, and poses the arm bones - no rendering needed, just node and
## skeleton state, so this runs fine under --headless with no GPU context.

var failures := 0

func _init():
	_run.call_deferred()

func _run() -> void:
	print("\n=== viewmodel arms smoke test ===\n")

	var ViewmodelArmsScript := load("res://player/viewmodel_arms.gd")
	var arms: Node3D = ViewmodelArmsScript.new()
	root.add_child(arms)

	await process_frame
	await process_frame

	var rig := arms.get_child(0)
	_check("rig instanced under ViewmodelArms", rig != null)

	var skeleton := rig.find_child("Skeleton3D", true, false) as Skeleton3D
	_check("Skeleton3D found", skeleton != null)

	var head := rig.find_child("Mesh_Head", true, false) as MeshInstance3D
	var leg_l := rig.find_child("Mesh_Leg_L", true, false) as MeshInstance3D
	var leg_r := rig.find_child("Mesh_Leg_R", true, false) as MeshInstance3D
	_check("Head mesh hidden", head != null and not head.visible)
	_check("Leg_L mesh hidden", leg_l != null and not leg_l.visible)
	_check("Leg_R mesh hidden", leg_r != null and not leg_r.visible)

	var arm_l := rig.find_child("Mesh_Arm_L", true, false) as MeshInstance3D
	var arm_r := rig.find_child("Mesh_Arm_R", true, false) as MeshInstance3D
	_check("Arm_L mesh visible", arm_l != null and arm_l.visible)
	_check("Arm_R mesh visible", arm_r != null and arm_r.visible)

	if skeleton:
		var idx_l := skeleton.find_bone("Arm_L")
		var idx_r := skeleton.find_bone("Arm_R")
		_check("Arm_L bone exists", idx_l >= 0)
		_check("Arm_R bone exists", idx_r >= 0)
		if idx_l >= 0:
			var rot := skeleton.get_bone_pose_rotation(idx_l).get_euler()
			_check("Arm_L bone posed away from rest (non-zero rotation)",
				rot.length() > 0.01)
		if idx_r >= 0:
			var rot := skeleton.get_bone_pose_rotation(idx_r).get_euler()
			_check("Arm_R bone posed away from rest (non-zero rotation)",
				rot.length() > 0.01)

	print("\n=== %d failure(s) ===" % failures)
	print("ALL GREEN" if failures == 0 else "FAILED")
	quit(1 if failures > 0 else 0)


func _check(label: String, cond: bool) -> void:
	if cond:
		print("  PASS  ", label)
	else:
		print("  FAIL  ", label)
		failures += 1
