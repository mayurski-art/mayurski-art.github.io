class_name ViewmodelArms
extends Node3D

## First-person trollface arms - the part of ../../trollface-characters
## rig you actually see as the player, since the rest of the body sits
## behind the camera in a first-person game.
##
## Instances the shared character.glb (TrollfaceRig > Skeleton3D >
## {Mesh_Arm_L, Mesh_Arm_R, Mesh_Head, Mesh_Leg_L, Mesh_Leg_R}, each mesh
## rigidly weighted 1.0 to its like-named bone - Arm_L/Arm_R/Head/Leg_L/
## Leg_R. Meshes and bones are deliberately NOT given identical names: the
## Blender build script (../../trollface-characters/tools/
## build_trollface_character.py) prefixes meshes with "Mesh_" because
## Blender's glTF exporter silently renames one side of a name collision
## (a bone called "Arm_L" next to a mesh object also called "Arm_L"
## exports as bone "Arm_L_2"), which would otherwise break bone lookups
## here without any error.
##
## The Head and both Leg meshes are hidden - only the arms belong in view
## space. Rather than fighting the skeleton binding by reparenting mesh
## nodes (which would detach them from their bone), the whole rig is
## scaled/positioned as one unit and the ARMS ARE POSED BY MOVING THEIR
## BONES in the Skeleton3D, exactly like poseHumanoid() does at runtime in
## ../../character.js for the web build.

const CHARACTER_SCENE := preload("res://character/trollface_operator.glb")

## Where the whole rig sits so its shoulder hub lands where a viewmodel
## weapon rest pose expects (see keyboard_sword.gd's REST_POS/ROT). The
## rig's own origin is at ground level (Hub bone sits ~1.4m up), so this
## offset pulls that hub down into view-space reach.
const RIG_OFFSET := Vector3(0.0, -1.15, -0.35)
const RIG_SCALE := 0.62

## Bone-local rest rotations (degrees) that pull the resting T-pose arms
## in to a "holding something" FPS pose. Applied as pose overrides on top
## of the bone's rest transform.
const ARM_L_POSE_ROT := Vector3(-40.0, -8.0, 18.0)
const ARM_R_POSE_ROT := Vector3(-46.0, 10.0, -14.0)

## Walk bob: a figure-8 the whole rig traces while moving on the ground -
## down-and-across on each footfall, back up between steps. Frequency is
## driven by actual speed (see tick()) rather than a fixed rate, so a walk
## and a sprint bob at visibly different tempos instead of the same loop
## just playing faster underneath.
const BOB_AMP_Y := 0.028
const BOB_AMP_X := 0.018
const BOB_SPEED_FOR_FULL_BOB := 7.8   # matches player.gd's sprint_speed

## Mouse-look sway: the arms lag a beat behind the camera's own rotation,
## like a real weapon has inertia the camera doesn't. Degrees per unit of
## remaining yaw/pitch error, damped back to zero each frame.
const LOOK_SWAY_AMOUNT := 0.045
const LOOK_SWAY_DAMP := 9.0

## Landing dip: a downward kick the instant the body goes airborne -> grounded,
## scaled by how fast it was falling, then sprung back up to rest. Falls
## under some minimum speed (a small step down, a shallow jump) don't dip at
## all - only a real fall reads as an impact worth reacting to.
const LAND_MIN_FALL_SPEED := 3.0
const LAND_MAX_FALL_SPEED := 11.0     # falls faster than this dip no harder
const LAND_DIP_AMOUNT := 0.09
const LAND_SPRING_STIFFNESS := 220.0  # higher = snaps back faster
const LAND_SPRING_DAMPING := 18.0     # higher = less bounce/overshoot

var _skeleton: Skeleton3D
var _arm_l_idx: int = -1
var _arm_r_idx: int = -1

var _bob_phase: float = 0.0
var _bob_offset := Vector3.ZERO
var _sway_rot := Vector2.ZERO      # x = pitch sway, y = yaw sway (radians)
var _last_camera_rot := Vector2.ZERO
var _camera: Camera3D
var _body: Node3D

var _was_grounded: bool = true
var _land_dip: float = 0.0         # current spring position (0 = rest)
var _land_dip_vel: float = 0.0     # current spring velocity


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

	# player.gd parents this node directly under its Camera3D, and the
	# camera in turn is a direct child of the CharacterBody3D - both are
	# already in the tree by the time _ready() runs here.
	_camera = get_parent() as Camera3D
	_body = _camera.get_parent() if _camera else null
	if _camera:
		_last_camera_rot = Vector2(_camera.rotation.x, _body.rotation.y if _body else 0.0)


func _apply_rest_pose() -> void:
	if _arm_l_idx >= 0:
		_skeleton.set_bone_pose_rotation(_arm_l_idx, Quaternion.from_euler(
			Vector3(deg_to_rad(ARM_L_POSE_ROT.x), deg_to_rad(ARM_L_POSE_ROT.y), deg_to_rad(ARM_L_POSE_ROT.z))))
	if _arm_r_idx >= 0:
		_skeleton.set_bone_pose_rotation(_arm_r_idx, Quaternion.from_euler(
			Vector3(deg_to_rad(ARM_R_POSE_ROT.x), deg_to_rad(ARM_R_POSE_ROT.y), deg_to_rad(ARM_R_POSE_ROT.z))))


## Called every physics frame by player.gd with the CharacterBody3D's own
## velocity/grounded state - the arms have no movement logic of their own,
## they just react to the body's. `fall_speed` is how fast the body was
## falling THIS frame (positive = moving down) - pass it from before
## move_and_slide() clamps velocity.y on landing, or the impact speed is
## already gone by the time this runs.
func apply_motion(delta: float, horizontal_speed: float, is_grounded: bool, fall_speed: float = 0.0) -> void:
	# Walk bob only while actually moving on the ground - airborne or
	# standing still, it settles back to the rest pose instead of still
	# bobbing in place.
	var bob_strength := 0.0
	if is_grounded and horizontal_speed > 0.1:
		bob_strength = clampf(horizontal_speed / BOB_SPEED_FOR_FULL_BOB, 0.0, 1.0)
		_bob_phase += delta * (6.0 + bob_strength * 5.5)

	_bob_offset.y = sin(_bob_phase * 2.0) * BOB_AMP_Y * bob_strength
	_bob_offset.x = sin(_bob_phase) * BOB_AMP_X * bob_strength

	# Mouse-look sway: measure how far the camera turned this frame and
	# push the arms the opposite way, then damp that push back to zero -
	# a spring with no overshoot, cheap enough to do by hand instead of
	# pulling in a real spring/damper node for two floats.
	if _camera:
		var cur := Vector2(_camera.rotation.x, _body.rotation.y if _body else 0.0)
		var delta_rot := cur - _last_camera_rot
		_last_camera_rot = cur
		_sway_rot -= delta_rot * LOOK_SWAY_AMOUNT
		_sway_rot = _sway_rot.lerp(Vector2.ZERO, clampf(delta * LOOK_SWAY_DAMP, 0.0, 1.0))

	# Landing dip: fires once on the airborne -> grounded edge, scaled by
	# how hard the landing was, then left to a damped spring to resolve -
	# not a fixed-length tween, so a stomp lands and settles at its own
	# pace instead of always taking the same time regardless of impact.
	if is_grounded and not _was_grounded and fall_speed > LAND_MIN_FALL_SPEED:
		var t := clampf((fall_speed - LAND_MIN_FALL_SPEED) / (LAND_MAX_FALL_SPEED - LAND_MIN_FALL_SPEED), 0.0, 1.0)
		_land_dip -= LAND_DIP_AMOUNT * t
	_was_grounded = is_grounded

	# Damped spring toward 0, semi-implicit Euler - stable at any delta
	# without needing sub-stepping, unlike a naive explicit integration
	# which can blow up if a frame hitches.
	var spring_accel := -LAND_SPRING_STIFFNESS * _land_dip - LAND_SPRING_DAMPING * _land_dip_vel
	_land_dip_vel += spring_accel * delta
	_land_dip += _land_dip_vel * delta

	position = _bob_offset + Vector3(0.0, _land_dip, 0.0)
	rotation = Vector3(_sway_rot.x, _sway_rot.y, 0.0)
