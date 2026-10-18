-- TrollUsClient (StarterPlayerScripts): top-down camera, the waddle for every Crewmate on screen,
-- ghost and vent visibility, and vision as black fog.
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local CS = game:GetService("CollectionService")
local Lighting = game:GetService("Lighting")
local RS = game:GetService("ReplicatedStorage")

local TU = RS:WaitForChild("TrollUs")
local Net = TU:WaitForChild("Net")
local player = Players.LocalPlayer
local camera = workspace.CurrentCamera

-- pitch = atan(up/back) ~ 55 degrees. A narrow FOV from far back keeps it close to the flat Among Us look;
-- at the default 70 the beans near the screen edges stretch and read as tipped over.
local CAM_FOV = 35
local CAM_UP, CAM_BACK = 60, 42
local CAM_D = math.sqrt(CAM_UP * CAM_UP + CAM_BACK * CAM_BACK)
local STEP_HZ = 2.4
local LEG_SWING = 0.9
local BOB = 0.16
local LEAN = 0.08
local FACE_YAW = 0.55
local VISION = { crew = 24, impostor = 36, lights = 8 }

local role, partners = "Crewmate", {}
Net.OnClientEvent:Connect(function(kind, data)
	if kind == "Role" then
		role = data.role
		partners = {}
		for _, id in ipairs(data.impostors or {}) do partners[id] = true end
	end
end)
TU:GetAttributeChangedSignal("Phase"):Connect(function()
	if TU:GetAttribute("Phase") == "Lobby" then role, partners = "Crewmate", {} end
end)

-- ---------- own character: facing + camera ----------
local myChar, myHrp, myHum, ao
local function setup(char)
	myChar = char
	myHrp = char:WaitForChild("HumanoidRootPart")
	myHum = char:WaitForChild("Humanoid")
	local att = Instance.new("Attachment"); att.Parent = myHrp
	ao = Instance.new("AlignOrientation")
	ao.Mode = Enum.OrientationAlignmentMode.OneAttachment
	ao.Attachment0 = att
	ao.RigidityEnabled = true
	ao.Parent = myHrp
	camera.CameraType = Enum.CameraType.Scriptable
end
if player.Character then task.spawn(setup, player.Character) end
player.CharacterAdded:Connect(setup)

-- ---------- per-model animation ----------
local anim = setmetatable({}, { __mode = "k" })
local function animate(m, dt)
	local hrp = m:FindFirstChild("HumanoidRootPart")
	local body = m:FindFirstChild("Body")
	if not hrp or not body then return end
	local root = hrp:FindFirstChild("Root")
	local legL, legR, pack = body:FindFirstChild("LegLJoint"), body:FindFirstChild("LegRJoint"), body:FindFirstChild("PackJoint")
	if not (root and legL and legR and pack) then return end
	local st = anim[m]
	if not st then st = { phase = 0, idle = 0 }; anim[m] = st end
	local v = hrp.AssemblyLinearVelocity
	local speed = math.min(Vector3.new(v.X, 0, v.Z).Magnitude / 14, 1)
	if m == myChar and myHum then speed = myHum.MoveDirection.Magnitude end
	if m:GetAttribute("Alive") == false then
		-- ghosts float and bob instead of walking
		st.idle += dt
		root.Transform = CFrame.new(0, 1 + 0.25 * math.sin(st.idle * 2), 0)
		return
	end
	if speed > 0.05 then
		st.phase += dt * STEP_HZ * math.pi * 2 * speed
		local s = math.sin(st.phase)
		legL.Transform = CFrame.Angles(s * LEG_SWING, 0, 0)
		legR.Transform = CFrame.Angles(-s * LEG_SWING, 0, 0)
		root.Transform = CFrame.new(0, math.abs(s) * BOB, 0) * CFrame.Angles(0, 0, s * LEAN)
		pack.Transform = CFrame.Angles(-math.abs(s) * 0.08, 0, 0)
		st.idle = 0
	else
		st.idle += dt
		local k = math.min(1, dt * 8)
		legL.Transform = legL.Transform:Lerp(CFrame.new(), k)
		legR.Transform = legR.Transform:Lerp(CFrame.new(), k)
		pack.Transform = pack.Transform:Lerp(CFrame.new(), k)
		root.Transform = root.Transform:Lerp(CFrame.new(0, 0.04 * math.sin(st.idle * 2.2), 0), k)
	end
end

local function setHidden(m, amount, tagMax)
	for _, d in ipairs(m:GetDescendants()) do
		if d:IsA("BasePart") and d.Name ~= "HumanoidRootPart" then d.LocalTransparencyModifier = amount
		elseif d:IsA("Decal") then d.LocalTransparencyModifier = amount
		elseif d:IsA("BillboardGui") then d.Enabled = amount < 0.99; d.MaxDistance = tagMax end
	end
end

-- ---------- frame ----------
local yaw = 0
RunService.RenderStepped:Connect(function(dt)
	local phase = TU:GetAttribute("Phase")
	local meAlive = not myChar or myChar:GetAttribute("Alive") ~= false

	if myHrp and myHrp.Parent then
		local pos = myHrp.Position
		camera.CameraType = Enum.CameraType.Scriptable
		camera.FieldOfView = CAM_FOV
		camera.CFrame = CFrame.lookAt(pos + Vector3.new(0, CAM_UP, CAM_BACK), pos)
		if ao and myHum then
			local mv = myHum.MoveDirection
			local target = mv.Magnitude > 0.05 and math.clamp(mv.X, -1, 1) * FACE_YAW or 0
			yaw += (target - yaw) * math.min(1, dt * 10)
			ao.CFrame = CFrame.Angles(0, math.pi + yaw, 0) -- front = (sin yaw, 0, cos yaw): turns toward the walk
		end
	end

	-- vision
	local r
	if phase == "Roam" and meAlive then
		if role == "Impostor" then r = VISION.impostor
		elseif TU:GetAttribute("Sabotage") == "Lights" then r = VISION.lights
		else r = VISION.crew end
	end
	local fogEnd = 1e5
	if r then
		fogEnd = math.sqrt(CAM_D * CAM_D + r * r)
		Lighting.FogColor = Color3.new(0, 0, 0)
		Lighting.FogStart = math.sqrt(CAM_D * CAM_D + (r * 0.55) ^ 2)
		Lighting.FogEnd = fogEnd
	else
		Lighting.FogStart = 0
		Lighting.FogEnd = 1e5
	end

	for _, m in ipairs(CS:GetTagged("Crewmate")) do
		if m:IsDescendantOf(workspace) then
			animate(m, dt)
			local hide = 0
			if m:GetAttribute("Alive") == false then
				hide = meAlive and 1 or 0.5
			end
			if m:GetAttribute("Venting") then hide = (m == myChar) and 0.6 or 1 end
			setHidden(m, hide, r and fogEnd or 1e5)
			-- fellow Impostors read in red
			local hrp = m:FindFirstChild("HumanoidRootPart")
			local tag = hrp and hrp:FindFirstChild("Tag")
			local nameLabel = tag and tag:FindFirstChild("Name")
			if nameLabel then
				local red = role == "Impostor" and partners[m:GetAttribute("TUId")]
				nameLabel.TextColor3 = red and Color3.fromRGB(255, 70, 70) or Color3.new(1, 1, 1)
			end
		end
	end
end)
