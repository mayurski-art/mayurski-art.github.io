-- TrollUsClient (StarterPlayerScripts): the first-person camera and look controls, the waddle for every
-- Crewmate on screen, ghost and vent visibility, and vision as black fog.
-- The HUD talks to this script through two attributes on the LocalPlayer:
--   UIOpen (bool)  a panel, the map or a menu is open: free the mouse
--   CamView (int)  1..4 = watching that security camera, 0/nil = own eyes
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UIS = game:GetService("UserInputService")
local CS = game:GetService("CollectionService")
local Lighting = game:GetService("Lighting")
local RS = game:GetService("ReplicatedStorage")

local TU = RS:WaitForChild("TrollUs")
local Net = TU:WaitForChild("Net")
local player = Players.LocalPlayer
local camera = workspace.CurrentCamera
local Map = workspace:WaitForChild("TrollUs"):WaitForChild("Map")

local FOV = 80
local EYE = 0.8          -- studs above the root's centre: the visor, 3.6 above the floor
local PITCH_MAX = math.rad(75)
local MOUSE_RAD = math.rad(0.25) -- per pixel, times the Roblox mouse sensitivity setting
local TOUCH_RAD = math.rad(0.32)
local STEP_HZ = 2.4
local LEG_SWING = 0.9
local BOB = 0.16
local LEAN = 0.08
local VISION = { crew = 24, impostor = 36, lights = 8 }

local KillClips = require(TU:WaitForChild("KillClips"))
local fx = Instance.new("Folder"); fx.Name = "TrollUsFX"; fx.Parent = workspace -- this client's own effects
local shakeUntil = 0

local role, partners = "Crewmate", {}
Net.OnClientEvent:Connect(function(kind, data)
	if kind == "Role" then
		role = data.role
		partners = {}
		for _, id in ipairs(data.impostors or {}) do partners[id] = true end
	elseif kind == "Kill" and data.from and data.at then
		-- everyone gets the clip in the world; within sight range it also shakes your view
		KillClips.play(fx, data.clip, data.from, data.at)
		local me = player.Character
		local myId = me and me:GetAttribute("TUId")
		local hrp = me and me:FindFirstChild("HumanoidRootPart")
		local near = hrp and (Vector3.new(hrp.Position.X - data.at.X, 0, hrp.Position.Z - data.at.Z).Magnitude < 14)
		if myId == data.killer or near then shakeUntil = os.clock() + 0.35 end
	end
end)
TU:GetAttributeChangedSignal("Phase"):Connect(function()
	if TU:GetAttribute("Phase") == "Lobby" then role, partners = "Crewmate", {} end
end)

-- ---------- own character ----------
local myChar, myHrp, myHum, ao
local yaw, pitch = 0, 0
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
	-- start looking the way the bean faces
	local look = myHrp.CFrame.LookVector
	yaw, pitch = math.atan2(-look.X, -look.Z), 0
end
if player.Character then task.spawn(setup, player.Character) end
player.CharacterAdded:Connect(setup)

-- ---------- look input ----------
local function mouseFree()
	local phase = TU:GetAttribute("Phase")
	if player:GetAttribute("UIOpen") then return true end
	if phase ~= "Roam" and phase ~= "Lobby" and phase ~= "Countdown" then return true end
	if (player:GetAttribute("CamView") or 0) > 0 then return true end
	-- the lobby has a START button to click: look by holding the right mouse button there
	if phase ~= "Roam" then return true end
	return UIS:IsKeyDown(Enum.KeyCode.LeftAlt) -- hold Alt in a round to click the HUD
end
local rmb = false
local function turn(dx, dy, k)
	yaw -= dx * k
	pitch = math.clamp(pitch - dy * k, -PITCH_MAX, PITCH_MAX)
end
UIS.InputBegan:Connect(function(input, processed)
	if input.UserInputType == Enum.UserInputType.MouseButton2 and not processed then rmb = true end
end)
UIS.InputEnded:Connect(function(input)
	if input.UserInputType == Enum.UserInputType.MouseButton2 then rmb = false end
end)
UIS.InputChanged:Connect(function(input, processed)
	if input.UserInputType == Enum.UserInputType.MouseMovement then
		if not mouseFree() or rmb then
			local sens = UserSettings():GetService("UserGameSettings").MouseSensitivity
			turn(input.Delta.X, input.Delta.Y, MOUSE_RAD * sens)
		end
	end
end)
-- phone: drag anywhere on the right 60 percent of the screen that is not a button; the stick owns the left
local lookTouch, lastTouch = nil, nil
UIS.TouchStarted:Connect(function(t, processed)
	if processed or lookTouch then return end
	if t.Position.X < camera.ViewportSize.X * 0.4 then return end
	lookTouch, lastTouch = t, t.Position
end)
UIS.TouchMoved:Connect(function(t)
	if t ~= lookTouch then return end
	local d = t.Position - lastTouch
	lastTouch = t.Position
	turn(d.X, d.Y, TOUCH_RAD)
end)
UIS.TouchEnded:Connect(function(t) if t == lookTouch then lookTouch = nil end end)

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

-- ---------- lights ----------
-- an Atmosphere switches classic fog off, and vision IS the fog; the Baseplate template ships one, and a
-- place saved before it was removed brings it back, so drop it here on every client
local function dropAtmosphere()
	for _, c in ipairs(Lighting:GetChildren()) do
		if c:IsA("Atmosphere") then c:Destroy() end
		if c:IsA("DepthOfFieldEffect") then c.Enabled = false end
	end
end
dropAtmosphere()
Lighting.ChildAdded:Connect(function() task.defer(dropAtmosphere) end)
local LIGHT = { Ambient = Lighting.Ambient, OutdoorAmbient = Lighting.OutdoorAmbient, Brightness = Lighting.Brightness }
local DARK = { Ambient = Color3.fromRGB(30, 30, 36), OutdoorAmbient = Color3.fromRGB(30, 30, 36), Brightness = 0.4 }
local lightsOut = false
local function setLights(out)
	if out == lightsOut then return end
	lightsOut = out
	for k, v in pairs(out and DARK or LIGHT) do Lighting[k] = v end
	local ceiling = Map:FindFirstChild("Ceiling")
	for _, p in ipairs(ceiling and ceiling:GetChildren() or {}) do
		if p.Name == "LightPanel" then
			p.Material = out and Enum.Material.SmoothPlastic or Enum.Material.Neon
			p.Color = out and Color3.fromRGB(50, 52, 60) or Color3.fromRGB(235, 240, 255)
		end
	end
end

-- a security camera view: from just under the camera box toward its LookAt point down the hall
local function camViewCFrame(n)
	local cam = Map.Cameras:FindFirstChild("Camera" .. n)
	local at = cam and cam:GetAttribute("LookAt")
	if not at then return nil end
	local p = cam.Position
	return CFrame.lookAt(p + (at - p).Unit * 1.4, at) -- a stud out in front, so the camera's own box stays out of shot
end

-- ---------- frame ----------
RunService:BindToRenderStep("TrollUsCamera", Enum.RenderPriority.Camera.Value + 1, function(dt)
	local phase = TU:GetAttribute("Phase")
	local meAlive = not myChar or myChar:GetAttribute("Alive") ~= false
	local venting = myChar and myChar:GetAttribute("Venting")
	local camView = player:GetAttribute("CamView") or 0

	-- Studio test hook: set TestYaw / TestPitch (radians) on the LocalPlayer to aim the camera
	if RunService:IsStudio() and player:GetAttribute("TestYaw") then
		yaw, pitch = player:GetAttribute("TestYaw"), player:GetAttribute("TestPitch") or 0
		player:SetAttribute("TestYaw", nil); player:SetAttribute("TestPitch", nil)
	end

	local free = mouseFree() and not rmb
	UIS.MouseBehavior = free and Enum.MouseBehavior.Default
		or (rmb and Enum.MouseBehavior.LockCurrentPosition or Enum.MouseBehavior.LockCenter)
	UIS.MouseIconEnabled = free

	camera.CameraType = Enum.CameraType.Scriptable
	camera.FieldOfView = FOV
	if camView > 0 and camViewCFrame(camView) then
		camera.CFrame = camViewCFrame(camView)
	elseif myHrp and myHrp.Parent then
		local p = myHrp.Position
		-- in a vent you peek out at floor level through the grate (the HUD draws the slats)
		local eye = venting and Vector3.new(p.X, 0.7, p.Z) or (p + Vector3.new(0, EYE, 0))
		local cf = CFrame.new(eye) * CFrame.Angles(0, yaw, 0) * CFrame.Angles(pitch, 0, 0)
		local shake = shakeUntil - os.clock()
		if shake > 0 then
			local a = 0.05 * shake / 0.35
			cf *= CFrame.Angles((math.random() - 0.5) * a, (math.random() - 0.5) * a, (math.random() - 0.5) * a)
		end
		camera.CFrame = cf
		-- the bean faces where you look, so others can see it (front is -Z)
		if ao then ao.CFrame = CFrame.Angles(0, yaw, 0) end
	end

	-- vision: in first person the fog distance is the vision radius itself; walls do the rest
	local r
	if (phase == "Roam" or phase == "Lobby" or phase == "Countdown") and meAlive and camView == 0 then
		if venting then r = 16
		elseif phase ~= "Roam" then r = VISION.crew
		elseif role == "Impostor" then r = VISION.impostor
		elseif TU:GetAttribute("Sabotage") == "Lights" then r = VISION.lights
		else r = VISION.crew end
	end
	if r then
		Lighting.FogColor = Color3.new(0, 0, 0)
		Lighting.FogStart = r * 0.55
		Lighting.FogEnd = r
	else
		Lighting.FogStart = 0
		Lighting.FogEnd = 1e5
	end
	setLights(phase == "Roam" and TU:GetAttribute("Sabotage") == "Lights" and role ~= "Impostor")

	for _, m in ipairs(CS:GetTagged("Crewmate")) do
		if m:IsDescendantOf(workspace) then
			animate(m, dt)
			local hide = 0
			if m == myChar then
				hide = camView > 0 and 0 or 1 -- your own bean never blocks your eyes
			elseif m:GetAttribute("Alive") == false then
				hide = meAlive and 1 or 0.5
			end
			if m ~= myChar and m:GetAttribute("Venting") then hide = 1 end
			setHidden(m, hide, r or 1e5)
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
