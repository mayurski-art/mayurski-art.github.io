-- Troll Us, phase 1: the Crewmate rig as StarterPlayer.StarterCharacter, plus the client scripts
-- (top-down camera, face-the-camera, procedural walk and idle). Run in Studio after build-skeld.
-- Face: a white plate where Among Us has the visor; the trollface Decal id is set by FACE_ASSET
-- (0 = plain white plate until the image is uploaded).

local StarterPlayer = game:GetService("StarterPlayer")
local StarterPlayerScripts = StarterPlayer:WaitForChild("StarterPlayerScripts")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local FACE_ASSET = 120956857562746 -- trollface_operator_trollface transparent.png, uploaded 2026-10-17
local SUITS = { -- the 12 lobby colours
	Red = Color3.fromRGB(197, 17, 17), Blue = Color3.fromRGB(19, 46, 209), Green = Color3.fromRGB(17, 127, 45),
	Pink = Color3.fromRGB(237, 84, 186), Orange = Color3.fromRGB(240, 125, 13), Yellow = Color3.fromRGB(245, 245, 87),
	Black = Color3.fromRGB(63, 71, 78), White = Color3.fromRGB(214, 224, 240), Purple = Color3.fromRGB(107, 47, 187),
	Brown = Color3.fromRGB(113, 73, 30), Cyan = Color3.fromRGB(56, 254, 220), Lime = Color3.fromRGB(80, 239, 57),
}

local function part(props)
	local p = Instance.new("Part")
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Material = Enum.Material.SmoothPlastic
	p.CanCollide = false
	p.Massless = true
	for k, v in pairs(props) do p[k] = v end
	return p
end
local function motor(name, p0, p1, c0)
	local m = Instance.new("Motor6D")
	m.Name = name; m.Part0 = p0; m.Part1 = p1
	m.C0 = c0; m.C1 = CFrame.new()
	m.Parent = p0
	return m
end

-- ---------- the rig ----------
-- Body front is -Z (the Decal goes on the Front face). Feet at y=0, top of the dome at y=5.5.
local function buildCrewmate(suit)
	local color = SUITS[suit] or SUITS.Red
	local m = Instance.new("Model"); m.Name = "StarterCharacter"

	-- chunky bean: 3.2 wide, 5.4 tall, flat disc bottom
	-- the only collider: a bit slimmer than the 3.2 bean and frictionless, so beans slide along walls
	-- instead of pinning on them next to the task pads
	local hrp = part({ Name = "HumanoidRootPart", Size = Vector3.new(2.6, 3.6, 2.6), Transparency = 1,
		CanCollide = true, Massless = false, CFrame = CFrame.new(0, 2.8, 0),
		CustomPhysicalProperties = PhysicalProperties.new(0.7, 0, 0, 100, 1), Parent = m })

	local body = part({ Name = "Body", Shape = Enum.PartType.Cylinder, Size = Vector3.new(2.6, 3.2, 3.2), Color = color,
		CFrame = CFrame.new(0, 2.5, 0) * CFrame.Angles(0, 0, math.rad(90)), Parent = m })
	local dome = part({ Name = "Dome", Shape = Enum.PartType.Ball, Size = Vector3.new(3.2, 3.2, 3.2), Color = color,
		CFrame = CFrame.new(0, 3.8, 0), Parent = m })
	local heel = part({ Name = "Heel", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.5, 3.2, 3.2), Color = color,
		CFrame = CFrame.new(0, 1.2, 0) * CFrame.Angles(0, 0, math.rad(90)), Parent = m }) -- flat bottom, no corners
	local legL = part({ Name = "LegL", Size = Vector3.new(1.0, 1.0, 1.3), Color = color,
		CFrame = CFrame.new(-0.8, 0.5, 0.1), Parent = m })
	local legR = part({ Name = "LegR", Size = Vector3.new(1.0, 1.0, 1.3), Color = color,
		CFrame = CFrame.new(0.8, 0.5, 0.1), Parent = m })
	local pack = part({ Name = "Backpack", Size = Vector3.new(1.9, 2.2, 1.0), Color = color,
		CFrame = CFrame.new(0, 2.9, 1.85), Parent = m })
	-- visor = flat elliptical cylinder sunk into the body; the axis is local X and a 90 yaw puts
	-- the Right cap on -Z (the front), so the Decal goes on Right
	-- goggle frame: a raised lip in a darker shade of the suit, a dark ring inside it, the white face proud of both,
	-- so the face reads as part of the suit instead of a sticker. Server paint() honours SuitShade.
	local lip = part({ Name = "VisorLip", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.5, 2.2, 2.9), Color = Color3.new(color.R * 0.72, color.G * 0.72, color.B * 0.72),
		CFrame = CFrame.new(0, 3.6, -1.5) * CFrame.Angles(0, math.rad(90), 0), Parent = m })
	lip:SetAttribute("SuitShade", 0.72)
	local ring = part({ Name = "VisorRing", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.3, 1.95, 2.65), Color = Color3.fromRGB(38, 38, 44),
		CFrame = CFrame.new(0, 3.6, -1.65) * CFrame.Angles(0, math.rad(90), 0), Parent = m })
	ring:SetAttribute("SuitShade", 0)
	local face = part({ Name = "Face", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.4, 1.7, 2.4), Color = Color3.fromRGB(255, 255, 255),
		CFrame = CFrame.new(0, 3.6, -1.65) * CFrame.Angles(0, math.rad(90), 0), Parent = m })
	if FACE_ASSET ~= 0 then
		local d = Instance.new("Decal"); d.Name = "Trollface"; d.Face = Enum.NormalId.Right
		d.Texture = "rbxassetid://" .. FACE_ASSET; d.Parent = face
	end

	-- joints: Root drives the whole bean; legs and pack hang off the body
	motor("Root", hrp, body, hrp.CFrame:ToObjectSpace(body.CFrame))
	motor("DomeJoint", body, dome, body.CFrame:ToObjectSpace(dome.CFrame))
	motor("HeelJoint", body, heel, body.CFrame:ToObjectSpace(heel.CFrame))
	motor("LegLJoint", body, legL, body.CFrame:ToObjectSpace(legL.CFrame))
	motor("LegRJoint", body, legR, body.CFrame:ToObjectSpace(legR.CFrame))
	motor("PackJoint", body, pack, body.CFrame:ToObjectSpace(pack.CFrame))
	motor("FaceJoint", body, face, body.CFrame:ToObjectSpace(face.CFrame))
	motor("VisorLipJoint", body, lip, body.CFrame:ToObjectSpace(lip.CFrame))
	motor("VisorRingJoint", body, ring, body.CFrame:ToObjectSpace(ring.CFrame))

	local hum = Instance.new("Humanoid"); hum.Parent = m
	hum.HipHeight = 1.0
	hum.WalkSpeed = 14
	hum.JumpPower = 0
	hum.AutoRotate = false -- the client script keeps the face toward the camera
	hum.NameDisplayDistance = 0
	hum.HealthDisplayDistance = 0
	m.PrimaryPart = hrp
	m:SetAttribute("Suit", suit)
	return m
end

local old = StarterPlayer:FindFirstChild("StarterCharacter"); if old then old:Destroy() end
buildCrewmate("Red").Parent = StarterPlayer
StarterPlayer.CharacterJumpPower = 0
StarterPlayer.EnableMouseLockOption = false

-- the palette, for the lobby later
local suits = ReplicatedStorage:FindFirstChild("TrollUsSuits") or Instance.new("Folder")
suits.Name = "TrollUsSuits"; suits:ClearAllChildren()
for name, c in pairs(SUITS) do
	local v = Instance.new("Color3Value"); v.Name = name; v.Value = c; v.Parent = suits
end
suits.Parent = ReplicatedStorage

-- ---------- client: camera + facing + walk ----------
local SRC = [==[
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local player = Players.LocalPlayer
local camera = workspace.CurrentCamera

local CAM_UP, CAM_BACK = 27, 19      -- pitch = atan(27/19) ~ 55 degrees; 42/30 showed too much ship
local STEP_HZ = 2.4                  -- strides per second at full speed
local LEG_SWING = 0.9                -- radians
local BOB = 0.16                     -- studs
local LEAN = 0.08                    -- radians, side to side
local FACE_YAW = 0.55                -- radians the bean turns toward its heading

local function setup(char)
	local hrp = char:WaitForChild("HumanoidRootPart")
	local hum = char:WaitForChild("Humanoid")
	local body = char:WaitForChild("Body")
	local root = hrp:WaitForChild("Root")
	local legL = body:WaitForChild("LegLJoint")
	local legR = body:WaitForChild("LegRJoint")
	local pack = body:WaitForChild("PackJoint")

	-- keep the face toward the camera: the rig's front is -Z, the camera sits on +Z,
	-- so the bean yaws 180 and then a little toward where it walks
	local att = Instance.new("Attachment"); att.Parent = hrp
	local ao = Instance.new("AlignOrientation")
	ao.Mode = Enum.OrientationAlignmentMode.OneAttachment
	ao.Attachment0 = att
	ao.RigidityEnabled = true
	ao.Parent = hrp

	camera.CameraType = Enum.CameraType.Scriptable
	local phase, yaw, idle = 0, 0, 0
	local conn
	conn = RunService.RenderStepped:Connect(function(dt)
		if not char.Parent then conn:Disconnect(); return end
		local pos = hrp.Position
		camera.CFrame = CFrame.lookAt(pos + Vector3.new(0, CAM_UP, CAM_BACK), pos)

		local mv = hum.MoveDirection
		local speed = mv.Magnitude
		local targetYaw = 0
		if speed > 0.05 then targetYaw = math.clamp(mv.X, -1, 1) * FACE_YAW end
		yaw += (targetYaw - yaw) * math.min(1, dt * 10)
		ao.CFrame = CFrame.Angles(0, math.pi + yaw, 0)

		if speed > 0.05 then
			phase += dt * STEP_HZ * math.pi * 2 * speed
			local s = math.sin(phase)
			legL.Transform = CFrame.new(0, 0, 0) * CFrame.Angles(s * LEG_SWING, 0, 0)
			legR.Transform = CFrame.new(0, 0, 0) * CFrame.Angles(-s * LEG_SWING, 0, 0)
			root.Transform = CFrame.new(0, math.abs(s) * BOB, 0) * CFrame.Angles(0, 0, s * LEAN)
			pack.Transform = CFrame.Angles(-math.abs(s) * 0.08, 0, 0)
			idle = 0
		else
			idle += dt
			local k = math.min(1, dt * 8)
			legL.Transform = legL.Transform:Lerp(CFrame.new(), k)
			legR.Transform = legR.Transform:Lerp(CFrame.new(), k)
			pack.Transform = pack.Transform:Lerp(CFrame.new(), k)
			-- breathe
			root.Transform = root.Transform:Lerp(CFrame.new(0, 0.04 * math.sin(idle * 2.2), 0), k)
		end
	end)
end

if player.Character then setup(player.Character) end
player.CharacterAdded:Connect(setup)
]==]

local oldLs = StarterPlayerScripts:FindFirstChild("TrollUsClient"); if oldLs then oldLs:Destroy() end
local ls = Instance.new("LocalScript"); ls.Name = "TrollUsClient"; ls.Source = SRC; ls.Parent = StarterPlayerScripts

print("Crewmate rig + TrollUsClient installed; press Play to walk the Skeld")
