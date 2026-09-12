class_name ViewmodelArms
extends Node3D

## First-person trollface arms - the part of ../../trollface-characters
## rig you actually see as the player, since the rest of the body sits
## behind the camera in a first-person game.
##
## Instances the shared character.glb (TrollfaceRig > Skeleton3D >
## {Mesh_Arm_L, Mesh_Arm_R, Mesh_Head, Mesh_Leg_L, Mesh_Leg_R}, each mesh
## rigidly weighted 1.0 to its like-named bone). Meshes and bones are
## deliberately NOT given identical names - see the naming note in
## ../../trollface-characters/tools/build_trollface_character.py
## (parent_and_weight docstring) for why.
##
## The Head and both Leg meshes are hidden - only the arms belong in view
## space. The whole rig is scaled/positioned as one unit and the arms are
## posed by moving their BONES in the Skeleton3D, matching a two-handed
## rifle grip rather than troll-melee-1's one-handed sword pose.

const CHARACTER_SCENE := preload("res://character/trollface_operator.glb")

const RIG_OFFSET := Vector3(0.2, -0.9, -0.65)
const RIG_SCALE := 0.62

## Arm_L/Arm_R's bind pose already carries a large baked-in rest rotation
## (~-25, ~147, ~147 degrees - hanging straight down at the character's
## side), and set_bone_pose_rotation() sets an ABSOLUTE pose rotation that
## composes with that rest, not a small delta from a neutral pose. The
## first values tried here (small deltas, copied from troll-melee-1's
## working one-handed pose) left the arms hanging almost straight down
## past the camera instead of raised - the two rigs' numbers aren't
## interchangeable because the composed result depends on the exact rest
## orientation, which isn't obvious from the angles alone. These values
## were found by rendering actual screenshots of the arm mesh at several
## candidates (not reasoned out from the rest transform) and picking the
## one that reads as two hands gripping the weapon in front of the
## camera - re-render (tools/screenshot_range.tscn) rather than
## re-deriving by hand if this ever needs retuning.
const ARM_L_POSE_ROT := Vector3(-170.0, 20.0, 0.0)
const ARM_R_POSE_ROT := Vector3(-170.0, -20.0, 0.0)

var _skeleton: Skeleton3D
var _arm_l_idx: int = -1
var _arm_r_idx: int = -1


func _ready() -> void:
	var rig := CHARACTER_SCENE.instantiate()
	add_child(rig)
	rig.position = RIG_OFFSET
	rig.scale = Vector3.ONE * RIG_SCALE

	_skeleton = rig.find_child("Skeleton3D", true, false) as Skeleton3D

	for hidden_name in ["Mesh_Head", "Mesh_Leg_L", "Mesh_Leg_R"]:
		var mesh := rig.find_child(hidden_name, true, false)
		if mesh is MeshInstance3D:
			mesh.visible = false

	if _skeleton == null:
		push_warning("[ViewmodelArms] no Skeleton3D found in trollface_operator.glb")
		return

	_arm_l_idx = _skeleton.find_bone("Arm_L")
	_arm_r_idx = _skeleton.find_bone("Arm_R")
	_apply_rest_pose()


func _apply_rest_pose() -> void:
	if _arm_l_idx >= 0:
		_skeleton.set_bone_pose_rotation(_arm_l_idx, Quaternion.from_euler(
			Vector3(deg_to_rad(ARM_L_POSE_ROT.x), deg_to_rad(ARM_L_POSE_ROT.y), deg_to_rad(ARM_L_POSE_ROT.z))))
	if _arm_r_idx >= 0:
		_skeleton.set_bone_pose_rotation(_arm_r_idx, Quaternion.from_euler(
			Vector3(deg_to_rad(ARM_R_POSE_ROT.x), deg_to_rad(ARM_R_POSE_ROT.y), deg_to_rad(ARM_R_POSE_ROT.z))))
