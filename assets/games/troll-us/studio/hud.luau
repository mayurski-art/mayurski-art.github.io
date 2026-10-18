-- TrollUsHUD (StarterPlayerScripts): every screen of the round, built in code.
-- Lobby > role reveal > HUD (task bar, list, buttons) > banner > meeting tablet > ejection > VICTORY / DEFEAT.
local Players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local UIS = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local CS = game:GetService("CollectionService")
local TweenService = game:GetService("TweenService")

local TU = RS:WaitForChild("TrollUs")
local Net = TU:WaitForChild("Net")
local Rules = require(TU:WaitForChild("Rules"))
local SUITS = RS:WaitForChild("TrollUsSuits")
local player = Players.LocalPlayer
local Root = workspace:WaitForChild("TrollUs")
local Map = Root:WaitForChild("Map")
local Bodies = Root:WaitForChild("Bodies")

local function R(k)
	local v = TU:GetAttribute(k)
	if v ~= nil then return v end
	return Rules[k]
end
local function now() return workspace:GetServerTimeNow() end
local function flat(a, b) return Vector3.new(a.X - b.X, 0, a.Z - b.Z).Magnitude end
local function suitColor(s) local v = s and SUITS:FindFirstChild(s); return v and v.Value or Color3.new(0.5, 0.5, 0.5) end

local me = { role = "Crewmate", partners = {}, tasks = {}, killReadyAt = 0, sabotageReadyAt = 0, doorsReadyAt = 0, voted = false, roster = {} }

-- ---------- gui helpers ----------
local INK = Color3.fromRGB(20, 22, 30)
local WHITE = Color3.new(1, 1, 1)
local GREEN = Color3.fromRGB(68, 214, 44)
local RED = Color3.fromRGB(235, 40, 40)
local BLUE = Color3.fromRGB(60, 140, 255)
local BOLD, BLACK = Enum.Font.GothamBold, Enum.Font.GothamBlack

local function new(class, props, parent)
	local o = Instance.new(class)
	for k, v in pairs(props or {}) do o[k] = v end
	if parent then o.Parent = parent end
	return o
end
local function round(o, r) new("UICorner", { CornerRadius = UDim.new(0, r or 10) }, o); return o end
local function outline(o, t, c) new("UIStroke", { Thickness = t or 2, Color = c or INK, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }, o); return o end
local function label(props, parent)
	local base = { BackgroundTransparency = 1, Font = BOLD, TextColor3 = WHITE, TextSize = 18, TextStrokeTransparency = 0.6 }
	for k, v in pairs(props) do base[k] = v end
	return new("TextLabel", base, parent)
end
local function swatch(color, size, parent)
	return round(outline(new("Frame", { BackgroundColor3 = color, Size = UDim2.fromOffset(size, size) }, parent), 2), size)
end

local gui = new("ScreenGui", { Name = "TrollUsHUD", ResetOnSpawn = false, IgnoreGuiInset = true,
	ZIndexBehavior = Enum.ZIndexBehavior.Sibling, DisplayOrder = 5 }, player:WaitForChild("PlayerGui"))
local scale = new("UIScale", {}, gui)
local function rescale()
	local vp = workspace.CurrentCamera.ViewportSize
	scale.Scale = math.clamp(math.min(vp.X / 1100, vp.Y / 680), 0.55, 1.25)
end
rescale()
workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(rescale)

-- ---------- HUD: task bar + list ----------
local hud = new("Frame", { Name = "Hud", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), Visible = false }, gui)
local bar = round(outline(new("Frame", { Position = UDim2.fromOffset(16, 16), Size = UDim2.fromOffset(380, 30),
	BackgroundColor3 = Color3.fromRGB(70, 74, 84) }, hud), 3), 6)
local barFill = round(new("Frame", { Size = UDim2.fromScale(0, 1), BackgroundColor3 = GREEN, BorderSizePixel = 0 }, bar), 6)
label({ Size = UDim2.fromScale(1, 1), Text = "TOTAL TASKS COMPLETED", TextSize = 15, Font = BLACK, TextStrokeTransparency = 0.2, ZIndex = 2 }, bar)

local taskBox = round(new("Frame", { Position = UDim2.fromOffset(16, 54), Size = UDim2.fromOffset(300, 40),
	AutomaticSize = Enum.AutomaticSize.Y, BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 0.45 }, hud), 8)
new("UIPadding", { PaddingTop = UDim.new(0, 8), PaddingBottom = UDim.new(0, 8), PaddingLeft = UDim.new(0, 10), PaddingRight = UDim.new(0, 10) }, taskBox)
new("UIListLayout", { Padding = UDim.new(0, 3), SortOrder = Enum.SortOrder.LayoutOrder }, taskBox)

local function drawTasks()
	for _, c in ipairs(taskBox:GetChildren()) do if c:IsA("TextLabel") then c:Destroy() end end
	local function line(text, color, order)
		label({ Text = text, TextColor3 = color, TextSize = 16, TextXAlignment = Enum.TextXAlignment.Left,
			Size = UDim2.new(1, 0, 0, 20), LayoutOrder = order }, taskBox)
	end
	if me.role == "Impostor" then
		line("Sabotage and kill everyone.", RED, 0)
		line("Fake Tasks:", WHITE, 1)
	end
	if TU:GetAttribute("Sabotage") == "Comms" and me.role ~= "Impostor" then
		line("Comms Sabotaged", RED, 2)
		return
	end
	for i, t in ipairs(me.tasks) do
		line(t.room .. ": " .. t.task, t.done and GREEN or WHITE, 2 + i)
	end
end

-- ---------- action buttons ----------
local function actionButton(text, x, y)
	local b = round(outline(new("TextButton", { AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, x, 1, y),
		Size = UDim2.fromOffset(100, 100), BackgroundColor3 = Color3.fromRGB(235, 235, 240), Text = text,
		Font = BLACK, TextSize = 18, TextColor3 = INK, AutoButtonColor = true }, hud), 3), 18)
	local cd = label({ Name = "CD", Size = UDim2.fromScale(1, 1), Text = "", TextSize = 40, Font = BLACK, TextColor3 = WHITE, TextStrokeTransparency = 0 }, b)
	return b, cd
end
local btnUse = actionButton("USE", -16, -16)
local btnReport = actionButton("REPORT", -124, -16)
local btnKill, killCD = actionButton("KILL", -232, -16)
local btnVent = actionButton("VENT", -16, -124)
local btnSab, sabCD = actionButton("SABOTAGE", -124, -124)
local btnExit = actionButton("EXIT", -232, -124)
btnSab.TextSize = 14
local function setOn(b, on)
	b.BackgroundTransparency = on and 0.05 or 0.55
	b.TextTransparency = on and 0 or 0.55
	b.Active = on
	b:SetAttribute("On", on)
end

-- ---------- sabotage menu ----------
local sabMenu = round(outline(new("Frame", { AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, -16, 1, -236),
	Size = UDim2.fromOffset(320, 210), BackgroundColor3 = Color3.fromRGB(40, 20, 24), Visible = false }, hud), 3), 12)
label({ Text = "SABOTAGE", Font = BLACK, Size = UDim2.new(1, 0, 0, 30), TextColor3 = RED }, sabMenu)
local function sabButton(text, x, y, w, kind, room)
	local b = round(new("TextButton", { Position = UDim2.fromOffset(x, y), Size = UDim2.fromOffset(w, 34),
		BackgroundColor3 = Color3.fromRGB(150, 30, 36), Text = text, Font = BOLD, TextSize = 14, TextColor3 = WHITE }, sabMenu), 8)
	b.Activated:Connect(function()
		Net:FireServer("Sabotage", kind, room)
		if kind == "Doors" then me.doorsReadyAt = now() + R("doorsCooldown") else me.sabotageReadyAt = now() + R("sabotageCooldown") end
		sabMenu.Visible = false
	end)
end
sabButton("Lights", 10, 34, 145, "Lights")
sabButton("Comms", 165, 34, 145, "Comms")
sabButton("Reactor", 10, 74, 145, "Reactor")
sabButton("O2", 165, 74, 145, "O2")
label({ Text = "Close doors", TextSize = 13, Position = UDim2.fromOffset(0, 112), Size = UDim2.new(1, 0, 0, 16) }, sabMenu)
local DOOR_ROOMS = { "Storage", "Admin", "Electrical", "MedBay", "Security", "Upper Engine", "Lower Engine" }
for i, room in ipairs(DOOR_ROOMS) do
	local col, row = (i - 1) % 4, math.floor((i - 1) / 4)
	local short = room:gsub(" Engine", " Eng")
	sabButton(short, 10 + col * 76, 132 + row * 38, 70, "Doors", room)
end

-- ---------- alarm ----------
local alarm = label({ AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 16), Size = UDim2.fromOffset(460, 36),
	Text = "", Font = BLACK, TextSize = 24, TextColor3 = RED, TextStrokeTransparency = 0, Visible = false }, gui)
local flash = new("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = RED, BackgroundTransparency = 1, ZIndex = 0 }, gui)

-- ---------- lobby ----------
local lobby = round(outline(new("Frame", { AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -24),
	Size = UDim2.fromOffset(440, 120), BackgroundColor3 = Color3.fromRGB(28, 30, 40), Visible = false }, gui), 3), 14)
label({ Text = "TROLL US", Font = BLACK, TextSize = 26, Size = UDim2.new(1, 0, 0, 34), Position = UDim2.fromOffset(0, 6) }, lobby)
local lobbyInfo = label({ Text = "", TextSize = 15, TextColor3 = Color3.fromRGB(190, 195, 210), Size = UDim2.new(1, 0, 0, 20), Position = UDim2.fromOffset(0, 40) }, lobby)
local btnStart = round(outline(new("TextButton", { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 66),
	Size = UDim2.fromOffset(180, 42), BackgroundColor3 = GREEN, Text = "START", Font = BLACK, TextSize = 22, TextColor3 = INK }, lobby), 3), 10)
btnStart.Activated:Connect(function() Net:FireServer("Start") end)
local countdown = label({ AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.35), Size = UDim2.fromOffset(300, 140),
	Text = "", Font = BLACK, TextSize = 120, TextStrokeTransparency = 0, Visible = false }, gui)

-- ---------- full-screen cards ----------
local function card(name)
	return new("Frame", { Name = name, Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.new(0, 0, 0), Visible = false, ZIndex = 10 }, gui)
end
local roleCard = card("Role")
local roleTitle = label({ AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.38), Size = UDim2.fromOffset(800, 120),
	Font = BLACK, TextSize = 96, ZIndex = 11 }, roleCard)
local roleSub = label({ AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.52), Size = UDim2.fromOffset(800, 40),
	TextSize = 24, ZIndex = 11 }, roleCard)
local roleRow = new("Frame", { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.fromScale(0.5, 0.6), Size = UDim2.fromOffset(800, 60),
	BackgroundTransparency = 1, ZIndex = 11 }, roleCard)
new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, HorizontalAlignment = Enum.HorizontalAlignment.Center, Padding = UDim.new(0, 10) }, roleRow)

local banner = new("Frame", { AnchorPoint = Vector2.new(0, 0.5), Position = UDim2.fromScale(0, 0.45), Size = UDim2.new(1, 0, 0, 150),
	BackgroundColor3 = Color3.fromRGB(120, 0, 0), Visible = false, ZIndex = 12 }, gui)
local bannerText = label({ Size = UDim2.new(1, 0, 0, 90), Font = BLACK, TextSize = 64, TextStrokeTransparency = 0, ZIndex = 13 }, banner)
local bannerSub = label({ Position = UDim2.fromOffset(0, 90), Size = UDim2.new(1, 0, 0, 40), TextSize = 22, ZIndex = 13 }, banner)

-- the victim's last view: the killer's bean lunging at you with the same clip everyone else saw
local died = card("Died")
died.BackgroundColor3 = Color3.fromRGB(70, 0, 0)
new("UIGradient", { Rotation = 90, Color = ColorSequence.new(Color3.fromRGB(150, 10, 10), Color3.fromRGB(10, 0, 0)) }, died)
local diedView = new("ViewportFrame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.42), Size = UDim2.fromScale(0.9, 0.8),
	BackgroundTransparency = 1, Ambient = Color3.fromRGB(150, 150, 160), LightColor = Color3.new(1, 1, 1),
	LightDirection = Vector3.new(-0.3, -1, 0.6), ZIndex = 11 }, died)
local diedCam = new("Camera", { FieldOfView = 50 }, diedView)
diedView.CurrentCamera = diedCam
local diedText = label({ AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -40), Size = UDim2.fromOffset(800, 80),
	Font = BLACK, TextSize = 58, ZIndex = 12, Text = "You were killed", TextStrokeTransparency = 0 }, died)
local KillClips = require(TU:WaitForChild("KillClips"))

-- a still copy of a bean for a ViewportFrame: anchored, scripts and tags gone, every joint back at rest
-- (a live bean is caught mid-waddle). Player characters are not archivable; flipping it only affects this client.
local function cloneAtRest(src)
	src.Archivable = true
	local m = src:Clone()
	if not m then return nil end
	CS:RemoveTag(m, "Crewmate") -- tags clone too; a preview must not count as a player (lobby count, taken colours)
	for _ = 1, 2 do -- root joint first, then the ones hanging off the body
		for _, mo in ipairs(m:GetDescendants()) do
			if mo:IsA("Motor6D") and mo.Part0 and mo.Part1 then mo.Part1.CFrame = mo.Part0.CFrame * mo.C0 * mo.C1:Inverse() end
		end
	end
	-- hats are welded to the dome, which just moved: put them back on it
	local hat, dome = m:FindFirstChild("Hat"), m:FindFirstChild("Dome")
	local srcHat, srcDome = src:FindFirstChild("Hat"), src:FindFirstChild("Dome")
	if hat and dome and srcHat and srcDome then
		local parts, srcParts = hat:GetChildren(), srcHat:GetChildren()
		for i, p in ipairs(parts) do
			if p:IsA("BasePart") and srcParts[i] then p.CFrame = dome.CFrame * srcDome.CFrame:ToObjectSpace(srcParts[i].CFrame) end
		end
	end
	for _, d in ipairs(m:GetDescendants()) do
		if d:IsA("LuaSourceContainer") or d:IsA("BillboardGui") or d:IsA("Humanoid") or d:IsA("Constraint") or d:IsA("AlignOrientation") then d:Destroy()
		elseif d:IsA("BasePart") then d.Anchored = true; d.LocalTransparencyModifier = 0 end
	end
	return m
end

local function playDeath(killerId, clip)
	diedView:ClearAllChildren()
	diedCam = new("Camera", { FieldOfView = 50 }, diedView)
	diedView.CurrentCamera = diedCam
	local src
	for _, m in ipairs(CS:GetTagged("Crewmate")) do if m:GetAttribute("TUId") == killerId then src = m end end
	local m = src and cloneAtRest(src)
	if not m then return end
	m:PivotTo(CFrame.new(0, 2.8, 0)) -- feet at 0, front (-Z) toward the camera
	m.Parent = diedView
	diedCam.CFrame = CFrame.lookAt(Vector3.new(0.4, 3.3, -7.4), Vector3.new(0, 3.0, 0)) -- the whole dome in shot
	-- the killer steps in at you while the props do the rest
	task.spawn(function()
		local t = 0
		while t < 0.4 and m.Parent do
			t += RunService.Heartbeat:Wait()
			m:PivotTo(CFrame.new(0, 2.8, -1.4 * math.clamp((t - 0.1) / 0.2, 0, 1)))
		end
	end)
	-- the "victim" is you, at the camera: the props come right at the screen
	-- the tongue goes past your lower left, so its tip never covers the grin
	local at = clip == "Tongue" and Vector3.new(-2.2, 0, -7.4) or Vector3.new(0, 0, -7.4)
	KillClips.play(diedView, clip or "Stab", Vector3.new(0, 0, -1.4), at)
end

local eject = card("Eject")
for _ = 1, 70 do
	new("Frame", { BackgroundColor3 = WHITE, BorderSizePixel = 0, Size = UDim2.fromOffset(2, 2),
		Position = UDim2.fromScale(math.random(), math.random()), ZIndex = 10 }, eject)
end
local ejectBean = swatch(WHITE, 70, eject)
ejectBean.ZIndex = 11
local ejectText = label({ AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(900, 60),
	Font = Enum.Font.Code, TextSize = 36, ZIndex = 12, TextStrokeTransparency = 1 }, eject)
local ejectSub = label({ AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.5, 52), Size = UDim2.fromOffset(900, 40),
	Font = Enum.Font.Code, TextSize = 26, ZIndex = 12, TextStrokeTransparency = 1, TextColor3 = Color3.fromRGB(200, 200, 210) }, eject)

local over = card("GameOver")
local overTitle = label({ AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.3), Size = UDim2.fromOffset(900, 130),
	Font = BLACK, TextSize = 110, ZIndex = 11 }, over)
local overSub = label({ AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.46), Size = UDim2.fromOffset(900, 40),
	TextSize = 26, ZIndex = 11 }, over)
local overImps = label({ AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.56), Size = UDim2.fromOffset(900, 40),
	TextSize = 22, ZIndex = 11, TextColor3 = Color3.fromRGB(255, 120, 120) }, over)

-- ---------- wardrobe (lobby laptop) ----------
local Hats = require(TU:WaitForChild("Hats"))
local wardrobe = round(outline(new("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.45),
	Size = UDim2.fromOffset(760, 430), BackgroundColor3 = Color3.fromRGB(28, 30, 40), Visible = false, ZIndex = 40 }, gui), 4), 18)
label({ Text = "WARDROBE", Font = BLACK, TextSize = 24, Size = UDim2.new(1, 0, 0, 40), Position = UDim2.fromOffset(0, 6), ZIndex = 41 }, wardrobe)
local wardClose = round(new("TextButton", { AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -10, 0, 10), Size = UDim2.fromOffset(32, 32),
	BackgroundColor3 = RED, Text = "X", Font = BLACK, TextSize = 16, TextColor3 = WHITE, ZIndex = 42 }, wardrobe), 16)
local wardView = round(new("ViewportFrame", { Position = UDim2.fromOffset(16, 56), Size = UDim2.fromOffset(300, 358),
	BackgroundColor3 = Color3.fromRGB(44, 48, 62), Ambient = Color3.fromRGB(150, 150, 160), LightDirection = Vector3.new(-0.4, -1, 0.5), ZIndex = 41 }, wardrobe), 14)
local wardCam = new("Camera", { FieldOfView = 40 }, wardView)
wardView.CurrentCamera = wardCam
wardCam.CFrame = CFrame.lookAt(Vector3.new(0, 4.4, -13), Vector3.new(0, 3.5, 0)) -- room above the dome for the tall hats
label({ Text = "COLOUR", Font = BLACK, TextSize = 16, TextXAlignment = Enum.TextXAlignment.Left, Position = UDim2.fromOffset(336, 52),
	Size = UDim2.fromOffset(200, 22), ZIndex = 41 }, wardrobe)
local suitGrid = new("Frame", { Position = UDim2.fromOffset(336, 78), Size = UDim2.fromOffset(404, 130), BackgroundTransparency = 1, ZIndex = 41 }, wardrobe)
new("UIGridLayout", { CellSize = UDim2.fromOffset(58, 58), CellPadding = UDim2.fromOffset(8, 8), SortOrder = Enum.SortOrder.LayoutOrder }, suitGrid)
label({ Text = "HAT", Font = BLACK, TextSize = 16, TextXAlignment = Enum.TextXAlignment.Left, Position = UDim2.fromOffset(336, 218),
	Size = UDim2.fromOffset(200, 22), ZIndex = 41 }, wardrobe)
local hatGrid = new("Frame", { Position = UDim2.fromOffset(336, 244), Size = UDim2.fromOffset(404, 170), BackgroundTransparency = 1, ZIndex = 41 }, wardrobe)
new("UIGridLayout", { CellSize = UDim2.fromOffset(124, 44), CellPadding = UDim2.fromOffset(8, 8), SortOrder = Enum.SortOrder.LayoutOrder }, hatGrid)

local suitButtons, hatButtons = {}, {}
local function wear(suit, hat)
	local c = player.Character
	Net:FireServer("Wardrobe", suit or (c and c:GetAttribute("Suit")), hat or (c and c:GetAttribute("Hat")))
end
for i, name in ipairs(Rules.suits) do
	local b = round(new("TextButton", { BackgroundColor3 = suitColor(name), Text = "", Font = BLACK, TextSize = 30, TextColor3 = INK,
		LayoutOrder = i, AutoButtonColor = false, ZIndex = 42 }, suitGrid), 29)
	suitButtons[name] = { button = b, stroke = new("UIStroke", { Thickness = 3, Color = INK, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }, b) }
	b.Activated:Connect(function() if b.Text == "" then wear(name, nil) end end)
end
for i, name in ipairs(Hats.LIST) do
	local b = round(outline(new("TextButton", { BackgroundColor3 = Color3.fromRGB(70, 76, 92), Text = name, Font = BOLD, TextSize = 15,
		TextColor3 = WHITE, LayoutOrder = i, ZIndex = 42 }, hatGrid), 2), 10)
	hatButtons[name] = b
	b.Activated:Connect(function() wear(nil, name) end)
end

local wardModel, wardKey = nil, nil
local function refreshWardrobe()
	local c = player.Character
	if not c then return end
	local mySuit, myHat = c:GetAttribute("Suit"), c:GetAttribute("Hat") or "None"
	-- colours another player wears are crossed out
	local taken = {}
	for _, m in ipairs(CS:GetTagged("Crewmate")) do if m ~= c and m:GetAttribute("Suit") then taken[m:GetAttribute("Suit")] = true end end
	for name, sb in pairs(suitButtons) do
		sb.button.Text = taken[name] and "X" or ""
		sb.button.BackgroundTransparency = taken[name] and 0.6 or 0
		sb.stroke.Color = (name == mySuit) and WHITE or INK
		sb.stroke.Thickness = (name == mySuit) and 5 or 3
	end
	for name, b in pairs(hatButtons) do b.BackgroundColor3 = (name == myHat) and Color3.fromRGB(68, 170, 60) or Color3.fromRGB(70, 76, 92) end
	-- rebuild the preview when what you wear changes
	local key = tostring(mySuit) .. "/" .. myHat
	if key ~= wardKey or not wardModel then
		wardKey = key
		if wardModel then wardModel:Destroy() end
		wardModel = cloneAtRest(c)
		if wardModel then
			for _, d in ipairs(wardModel:GetDescendants()) do
				if d:IsA("BasePart") and d.Name == "GhostTail" then d.Transparency = 1 end
			end
			wardModel.Parent = wardView
		end
	end
end
local function openWardrobe(on)
	wardrobe.Visible = on
	if on then wardKey = nil; refreshWardrobe() end
end
wardClose.Activated:Connect(function() openWardrobe(false) end)
local btnWard = round(outline(new("TextButton", { AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(0.5, -8, 0, 66),
	Size = UDim2.fromOffset(180, 42), BackgroundColor3 = Color3.fromRGB(110, 200, 255), Text = "WARDROBE", Font = BLACK, TextSize = 20, TextColor3 = INK }, lobby), 3), 10)
btnWard.Activated:Connect(function() openWardrobe(not wardrobe.Visible) end)
btnStart.AnchorPoint = Vector2.new(0, 0)
btnStart.Position = UDim2.new(0.5, 8, 0, 66)
RunService.RenderStepped:Connect(function()
	if not wardrobe.Visible then return end
	if TU:GetAttribute("Phase") ~= "Lobby" then openWardrobe(false); return end
	refreshWardrobe()
	if wardModel then wardModel:PivotTo(CFrame.new(0, 2.8, 0) * CFrame.Angles(0, math.sin(os.clock() * 0.8) * 0.45, 0)) end
end)
local laptopHint = round(new("TextLabel", { AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -160), Size = UDim2.fromOffset(200, 34),
	BackgroundColor3 = Color3.fromRGB(20, 22, 30), BackgroundTransparency = 0.2, Text = "E  ·  Wardrobe", Font = BLACK, TextSize = 17,
	TextColor3 = WHITE, Visible = false }, gui), 8)
local function nearLaptop(pos)
	local stand = Map.Props:FindFirstChild("LaptopStand")
	return stand and flat(stand.Position, pos) <= R("useRange") + 1
end

-- ---------- task tablet ----------
-- one shared frame; each task's mini-game (TaskPanels) is built into its game area. The tablet has its own
-- ScreenGui with no UIScale: it fills 90 percent of a phone's width and keeps every control at 44 px or more.
local TaskPanels = require(TU:WaitForChild("TaskPanels"))
local taskGui = new("ScreenGui", { Name = "TrollUsTask", ResetOnSpawn = false, IgnoreGuiInset = false,
	ZIndexBehavior = Enum.ZIndexBehavior.Sibling, DisplayOrder = 6 }, player:WaitForChild("PlayerGui"))
local panel = round(outline(new("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5),
	BackgroundColor3 = Color3.fromRGB(46, 50, 62), Visible = false, ZIndex = 50 }, taskGui), 4), 18)
local panelTitle = label({ Size = UDim2.new(1, -120, 0, 30), Position = UDim2.fromOffset(60, 8), Font = BLACK, TextSize = 24, TextScaled = true, ZIndex = 51 }, panel)
new("UITextSizeConstraint", { MaxTextSize = 24 }, panelTitle)
local panelRoom = label({ Size = UDim2.new(1, -120, 0, 18), Position = UDim2.fromOffset(60, 38), TextSize = 14, TextColor3 = Color3.fromRGB(180, 186, 200), ZIndex = 51 }, panel)
local panelClose = round(outline(new("TextButton", { AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -8, 0, 8), Size = UDim2.fromOffset(44, 44),
	BackgroundColor3 = RED, Text = "X", Font = BLACK, TextSize = 20, TextColor3 = WHITE, ZIndex = 52 }, panel), 2), 22)
local gameArea = round(new("Frame", { Position = UDim2.fromOffset(12, 60), Size = UDim2.new(1, -24, 1, -72), BackgroundColor3 = Color3.fromRGB(34, 37, 48),
	ClipsDescendants = true, ZIndex = 51 }, panel), 12)
local doneCard = round(outline(new("TextLabel", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.new(0.7, 0, 0, 70),
	BackgroundColor3 = GREEN, Text = "TASK COMPLETE", Font = BLACK, TextScaled = true, TextColor3 = INK, Visible = false, ZIndex = 70 }, panel), 3), 14)
new("UITextSizeConstraint", { MaxTextSize = 34 }, doneCard)
new("UIPadding", { PaddingTop = UDim.new(0, 12), PaddingBottom = UDim.new(0, 12) }, doneCard)
local openTask, cleanupGame = nil, nil
local function closePanel()
	panel.Visible = false; doneCard.Visible = false; openTask = nil
	if cleanupGame then cleanupGame(); cleanupGame = nil end
end
panelClose.Activated:Connect(closePanel)
local function openPanel(d)
	closePanel()
	openTask = d
	-- Studio test hook: a TestViewport (Vector2) attribute on the LocalPlayer sizes the tablet as if on that screen
	local vp = (RunService:IsStudio() and player:GetAttribute("TestViewport")) or workspace.CurrentCamera.ViewportSize
	panel.Size = UDim2.fromOffset(math.floor(math.min(vp.X * 0.9, 760)), math.floor(math.min(vp.Y * 0.88, 500)))
	panelTitle.Text = d.task; panelRoom.Text = d.room
	panel.Visible = true
	task.wait() -- let the frame lay out so the game area has its size
	if openTask ~= d then return end
	local c = player.Character
	local info = { name = player.DisplayName, suit = c and c:GetAttribute("Suit"), room = d.room,
		scan = function() Net:FireServer("Scan") end }
	cleanupGame = TaskPanels.open(gameArea, d.task, info, function()
		doneCard.Visible = true
		-- the server wants a moment between opening and finishing a task
		local wait = math.max(0, 1.1 - (os.clock() - d.openedAt))
		task.delay(wait, function()
			if openTask == d then Net:FireServer("TaskDone", d.id) end
		end)
		task.delay(wait + 0.7, function() if openTask == d then closePanel() end end)
	end)
end

-- ---------- meeting tablet ----------
local meeting = round(outline(new("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5),
	Size = UDim2.fromOffset(1020, 620), BackgroundColor3 = Color3.fromRGB(150, 170, 200), Visible = false, ZIndex = 5 }, gui), 6), 24)
label({ Text = "Who Is The Impostor?", Font = BLACK, TextSize = 34, TextColor3 = INK, TextStrokeTransparency = 1,
	Size = UDim2.fromOffset(620, 50), Position = UDim2.fromOffset(20, 10), TextXAlignment = Enum.TextXAlignment.Left, ZIndex = 6 }, meeting)
local meetTimer = label({ Text = "", TextSize = 20, TextColor3 = INK, TextStrokeTransparency = 1, Size = UDim2.fromOffset(620, 26),
	Position = UDim2.fromOffset(20, 572), TextXAlignment = Enum.TextXAlignment.Right, ZIndex = 6 }, meeting)
local grid = new("Frame", { Position = UDim2.fromOffset(20, 66), Size = UDim2.fromOffset(620, 450), BackgroundTransparency = 1, ZIndex = 6 }, meeting)
new("UIGridLayout", { CellSize = UDim2.fromOffset(304, 82), CellPadding = UDim2.fromOffset(12, 8), SortOrder = Enum.SortOrder.LayoutOrder }, grid)
local skipBtn = round(outline(new("TextButton", { Position = UDim2.fromOffset(20, 566), Size = UDim2.fromOffset(170, 40),
	BackgroundColor3 = Color3.fromRGB(230, 232, 240), Text = "SKIP VOTE", Font = BLACK, TextSize = 18, TextColor3 = INK, ZIndex = 6 }, meeting), 2), 10)
local skipVotes = new("Frame", { Position = UDim2.fromOffset(200, 576), Size = UDim2.fromOffset(240, 22), BackgroundTransparency = 1, ZIndex = 6 }, meeting)
new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 3) }, skipVotes)

local chatBox = round(new("Frame", { Position = UDim2.fromOffset(660, 66), Size = UDim2.fromOffset(340, 540), BackgroundColor3 = Color3.fromRGB(235, 238, 245), ZIndex = 6 }, meeting), 14)
local chatLog = new("ScrollingFrame", { Position = UDim2.fromOffset(8, 8), Size = UDim2.new(1, -16, 1, -64), BackgroundTransparency = 1,
	CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y, ScrollBarThickness = 6, ZIndex = 7 }, chatBox)
new("UIListLayout", { Padding = UDim.new(0, 6), SortOrder = Enum.SortOrder.LayoutOrder }, chatLog)
local chatInput = round(outline(new("TextBox", { Position = UDim2.new(0, 8, 1, -48), Size = UDim2.new(1, -16, 0, 40), BackgroundColor3 = WHITE,
	PlaceholderText = "Type here and press Enter", Text = "", Font = BOLD, TextSize = 16, TextColor3 = INK, ClearTextOnFocus = false,
	TextXAlignment = Enum.TextXAlignment.Left, ZIndex = 7 }, chatBox), 1, Color3.fromRGB(160, 165, 180)), 8)
new("UIPadding", { PaddingLeft = UDim.new(0, 10) }, chatInput)
local chatOrder = 0
chatInput.FocusLost:Connect(function(enter)
	if enter and chatInput.Text ~= "" then
		Net:FireServer("Chat", chatInput.Text)
		chatInput.Text = ""
	end
end)

local rows, selected = {}, nil
local function setSelected(id)
	selected = id
	for rid, row in pairs(rows) do
		row.frame.BackgroundColor3 = (rid == id) and Color3.fromRGB(255, 240, 160) or (row.alive and WHITE or Color3.fromRGB(150, 150, 160))
		row.confirm.Visible = rid == id
	end
	skipBtn.Text = (id == "skip") and "CONFIRM SKIP?" or "SKIP VOTE"
end
local function vote(id)
	if TU:GetAttribute("Phase") ~= "Vote" or me.voted or not me.alive() then return end
	if selected ~= id then setSelected(id); return end
	me.voted = true
	Net:FireServer("Vote", id)
	setSelected(nil)
end
skipBtn.Activated:Connect(function() vote("skip") end)

local function buildRows(roster)
	for _, c in ipairs(grid:GetChildren()) do if c:IsA("GuiObject") then c:Destroy() end end
	rows = {}
	for i, r in ipairs(roster) do
		local f = round(outline(new("TextButton", { Text = "", BackgroundColor3 = r.alive and WHITE or Color3.fromRGB(150, 150, 160),
			LayoutOrder = i, AutoButtonColor = r.alive, ZIndex = 7 }, grid), 2), 12)
		local sw = swatch(suitColor(r.suit), 52, f)
		sw.Position = UDim2.fromOffset(12, 15); sw.ZIndex = 8
		label({ Text = r.name, Font = BLACK, TextSize = 20, TextColor3 = INK, TextStrokeTransparency = 1, Position = UDim2.fromOffset(76, 8),
			Size = UDim2.fromOffset(200, 30), TextXAlignment = Enum.TextXAlignment.Left, ZIndex = 8 }, f)
		if not r.alive then
			label({ Text = "X", Font = BLACK, TextSize = 46, TextColor3 = RED, Position = UDim2.fromOffset(12, 15), Size = UDim2.fromOffset(52, 52), ZIndex = 9 }, f)
		end
		local voted = round(new("TextLabel", { Text = "I VOTED", Font = BLACK, TextSize = 12, TextColor3 = WHITE, BackgroundColor3 = RED,
			Position = UDim2.fromOffset(4, 4), Size = UDim2.fromOffset(62, 18), Rotation = -12, Visible = false, ZIndex = 10 }, f), 4)
		local confirm = label({ Text = "CONFIRM?", Font = BLACK, TextSize = 14, TextColor3 = Color3.fromRGB(30, 130, 30), TextStrokeTransparency = 1,
			Position = UDim2.new(1, -96, 0, 8), Size = UDim2.fromOffset(88, 20), Visible = false, ZIndex = 8 }, f)
		local strip = new("Frame", { Position = UDim2.fromOffset(76, 44), Size = UDim2.fromOffset(220, 24), BackgroundTransparency = 1, ZIndex = 8 }, f)
		new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 3) }, strip)
		rows[r.id] = { frame = f, voted = voted, confirm = confirm, strip = strip, alive = r.alive }
		if r.alive then f.Activated:Connect(function() vote(r.id) end) end
	end
	for _, c in ipairs(skipVotes:GetChildren()) do if c:IsA("GuiObject") then c:Destroy() end end
	for _, c in ipairs(chatLog:GetChildren()) do if c:IsA("GuiObject") then c:Destroy() end end
end

local function addChat(from, suit, text, ghost)
	chatOrder += 1
	local f = new("Frame", { Size = UDim2.new(1, -8, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1, LayoutOrder = chatOrder, ZIndex = 7 }, chatLog)
	local sw = swatch(suitColor(suit), 26, f); sw.ZIndex = 8
	label({ Text = from .. (ghost and " (ghost)" or ""), Font = BLACK, TextSize = 14, TextColor3 = ghost and Color3.fromRGB(120, 120, 140) or INK,
		TextStrokeTransparency = 1, Position = UDim2.fromOffset(34, 0), Size = UDim2.new(1, -34, 0, 16), TextXAlignment = Enum.TextXAlignment.Left, ZIndex = 8 }, f)
	label({ Text = text, TextSize = 15, TextColor3 = INK, TextStrokeTransparency = 1, TextWrapped = true, AutomaticSize = Enum.AutomaticSize.Y,
		Position = UDim2.fromOffset(34, 16), Size = UDim2.new(1, -34, 0, 18), TextXAlignment = Enum.TextXAlignment.Left, ZIndex = 8 }, f)
	task.defer(function() chatLog.CanvasPosition = Vector2.new(0, 1e6) end)
end

-- ---------- state helpers ----------
local function myChar() return player.Character end
function me.alive() local c = myChar(); return not c or c:GetAttribute("Alive") ~= false end
local function myPos() local c = myChar(); local h = c and c:FindFirstChild("HumanoidRootPart"); return h and h.Position end

local function nearbyTaskPad(pos)
	for _, t in ipairs(me.tasks) do
		if not t.done then
			for _, pad in ipairs(Map.Tasks:GetChildren()) do
				if pad:GetAttribute("TaskId") == t.id and flat(pad.Position, pos) <= R("useRange") then return pad end
			end
		end
	end
end
local function nearbyFix(pos)
	local kind = TU:GetAttribute("Sabotage")
	if not kind or kind == "" then return end
	for _, f in ipairs(Map.FixPads:GetChildren()) do
		if f:GetAttribute("Kind") == kind and not f:GetAttribute("Fixed") and flat(f.Position, pos) <= R("useRange") then return f end
	end
end
-- both match the server's checks: a body you can see, a victim inside the cone in front of you
local function nearbyBody(pos)
	for _, b in ipairs(Bodies:GetChildren()) do
		local bp = b:GetPivot().Position
		if flat(bp, pos) <= R("reportRange") and Rules.lineOfSight(Map, pos, bp) then return b end
	end
end
local function nearbyVictim(pos)
	local look = workspace.CurrentCamera.CFrame.LookVector
	local fwd = Vector3.new(look.X, 0, look.Z)
	fwd = fwd.Magnitude > 0 and fwd.Unit or Vector3.new(0, 0, -1)
	local cosCone = math.cos(math.rad(R("killCone")))
	for _, m in ipairs(CS:GetTagged("Crewmate")) do
		if m ~= myChar() and m:GetAttribute("Alive") ~= false and not me.partners[m:GetAttribute("TUId")] then
			local h = m:FindFirstChild("HumanoidRootPart")
			local d = h and flat(h.Position, pos)
			if d and d <= R("killRange") then
				local to = Vector3.new(h.Position.X - pos.X, 0, h.Position.Z - pos.Z)
				if d < R("killPointBlank") or (to.Magnitude > 0 and fwd:Dot(to.Unit) >= cosCone) then return m end
			end
		end
	end
end
local function nearbyVent(pos)
	for _, v in ipairs(Map.Vents:GetChildren()) do
		if flat(v.Position, pos) <= R("ventRange") then return v end
	end
end

-- ---------- first person: goggle frame, centre dot, task arrow ----------
-- its own ScreenGui with no UIScale, so viewport points from the camera land where they should
local fpGui = new("ScreenGui", { Name = "TrollUsGoggles", ResetOnSpawn = false, IgnoreGuiInset = true, DisplayOrder = 1 }, player.PlayerGui)
-- UIStroke draws outward from a frame's edge: the lip is a fat stroke from 20 px in to past the screen edge,
-- the dark ring a thin one just inside it. Together they are the inside of your own goggle frame.
local lipFrame = round(new("Frame", { BackgroundTransparency = 1, Position = UDim2.fromOffset(20, 20), Size = UDim2.new(1, -40, 1, -40), ZIndex = 2 }, fpGui), 36)
local lipStroke = new("UIStroke", { Thickness = 80, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }, lipFrame)
local ringFrame = round(new("Frame", { BackgroundTransparency = 1, Position = UDim2.fromOffset(24, 24), Size = UDim2.new(1, -48, 1, -48), ZIndex = 2 }, fpGui), 32)
new("UIStroke", { Thickness = 4, Color = Color3.fromRGB(38, 38, 44), ApplyStrokeMode = Enum.ApplyStrokeMode.Border }, ringFrame)
local dot = round(outline(new("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(6, 6),
	BackgroundColor3 = WHITE }, fpGui), 1.5), 3)
local arrow = label({ Text = "▲", Font = BLACK, TextSize = 30, TextColor3 = Color3.fromRGB(255, 220, 60), TextStrokeTransparency = 0,
	AnchorPoint = Vector2.new(0.5, 0.5), Size = UDim2.fromOffset(40, 40), Visible = false }, fpGui)
-- vent grate: dark slats across your view while you hide in a vent
local ventGrate = new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), Visible = false, ZIndex = 0 }, fpGui) -- under the goggle rim
for i = 0, 7 do
	new("Frame", { BackgroundColor3 = Color3.fromRGB(14, 15, 20), BorderSizePixel = 0, BackgroundTransparency = 0.08,
		Position = UDim2.fromScale(0, i / 8), Size = UDim2.new(1, 0, 1 / 16, 0) }, ventGrate)
end
local altHint = label({ Text = "Hold Alt to use the mouse", TextSize = 14, TextColor3 = Color3.fromRGB(200, 205, 215),
	AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 36, 1, -32), Size = UDim2.fromOffset(240, 18),
	TextXAlignment = Enum.TextXAlignment.Left, Visible = false }, fpGui)

-- ---------- the map ----------
local mapFrame = round(outline(new("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5),
	Size = UDim2.fromOffset(640, 424), BackgroundColor3 = Color3.fromRGB(22, 34, 60), Visible = false, ZIndex = 30 }, gui), 4), 18)
label({ Text = "THE SKELD", Font = BLACK, TextSize = 22, Size = UDim2.new(1, 0, 0, 36), Position = UDim2.fromOffset(0, 4), ZIndex = 31 }, mapFrame)
local mapClose = round(new("TextButton", { AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -10, 0, 8), Size = UDim2.fromOffset(30, 30),
	BackgroundColor3 = RED, Text = "X", Font = BLACK, TextSize = 16, TextColor3 = WHITE, ZIndex = 33 }, mapFrame), 15)
local mapArea = new("Frame", { Position = UDim2.fromOffset(20, 48), Size = UDim2.fromOffset(600, 360), BackgroundTransparency = 1, ZIndex = 31 }, mapFrame)
local MX, MZ, MS = -100, -60, 3 -- the ship spans x -100..100, z -60..60; 3 px a stud; -Z (yaw 0) is up
local function mapPos(p) return UDim2.fromOffset((p.X - MX) * MS, (p.Z - MZ) * MS) end
local mapBuilt, mapMarks, mapMe = false, nil, nil
local function buildMap()
	mapBuilt = true
	for _, folder in ipairs({ Map.Halls, Map.Rooms }) do
		local isRoom = folder == Map.Rooms
		for _, part in ipairs(folder:GetChildren()) do
			if part:IsA("BasePart") then
				local f = new("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = mapPos(part.Position),
					Size = UDim2.fromOffset(part.Size.X * MS, part.Size.Z * MS), BorderSizePixel = 0, ZIndex = isRoom and 33 or 32,
					BackgroundColor3 = isRoom and Color3.fromRGB(150, 172, 210) or Color3.fromRGB(104, 124, 160) }, mapArea)
				if isRoom then
					local l = label({ Text = part.Name, Font = BOLD, TextColor3 = INK, TextStrokeTransparency = 1, TextScaled = true,
						AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.new(1, -4, 0, 14), ZIndex = 34 }, f)
					new("UITextSizeConstraint", { MaxTextSize = 11 }, l) -- shrink long names to fit, never break a word
				end
			end
		end
	end
	mapMarks = new("Frame", { Name = "Marks", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), ZIndex = 36 }, mapArea)
	mapMe = label({ Text = "▲", Font = BLACK, TextSize = 20, AnchorPoint = Vector2.new(0.5, 0.5), Size = UDim2.fromOffset(22, 22),
		TextStrokeTransparency = 0, ZIndex = 37 }, mapArea)
end
local function toggleMap(on)
	if on == nil then on = not mapFrame.Visible end
	if on and not mapBuilt then buildMap() end
	mapFrame.Visible = on
end
mapClose.Activated:Connect(function() toggleMap(false) end)
local btnMap = round(outline(new("TextButton", { AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -16, 0, 16),
	Size = UDim2.fromOffset(64, 64), BackgroundColor3 = Color3.fromRGB(235, 235, 240), Text = "MAP", Font = BLACK, TextSize = 16, TextColor3 = INK }, hud), 3), 14)
btnMap.Activated:Connect(function() toggleMap() end)

-- ---------- security cameras ----------
local CAM_NAMES = { "Upper Engine hall", "Electrical hall", "O2 hall", "Navigation hall" }
local camUI = round(outline(new("Frame", { AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -24), Size = UDim2.fromOffset(560, 64),
	BackgroundColor3 = Color3.fromRGB(20, 22, 30), BackgroundTransparency = 0.15, Visible = false, ZIndex = 30 }, gui), 3), 12)
-- label spans the gap between "<" (10..50) and ">" (360..400)
local camLabel = label({ Text = "", Font = BLACK, TextSize = 17, Position = UDim2.fromOffset(56, 0), Size = UDim2.fromOffset(298, 64), ZIndex = 31 }, camUI)
local rec = label({ Text = "● REC", Font = BLACK, TextSize = 16, TextColor3 = RED, AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -96, 0, 36),
	Size = UDim2.fromOffset(80, 22), Visible = false, ZIndex = 30, TextXAlignment = Enum.TextXAlignment.Right }, gui)
local camN = 0
local function setCam(n)
	camN = n
	player:SetAttribute("CamView", n)
	camUI.Visible = n > 0
	rec.Visible = n > 0
	if n > 0 then camLabel.Text = "CAMERA " .. n .. "  ·  " .. CAM_NAMES[n] end
end
local function camButton(text, x, w, f)
	local b = round(new("TextButton", { Position = UDim2.fromOffset(x, 12), Size = UDim2.fromOffset(w, 40), BackgroundColor3 = Color3.fromRGB(70, 76, 92),
		Text = text, Font = BLACK, TextSize = 18, TextColor3 = WHITE, ZIndex = 31 }, camUI), 8)
	b.Activated:Connect(f)
end
camButton("<", 10, 40, function() setCam((camN - 2) % 4 + 1) end)
camButton(">", 360, 40, function() setCam(camN % 4 + 1) end)
camButton("CLOSE", 560 - 96, 86, function() setCam(0) end)
local function nearDesk(pos)
	local desk = Map.Props:FindFirstChild("SecurityDesk")
	return desk and flat(desk.Position, pos) <= R("useRange") + 1
end

-- ---------- actions ----------
local function doUse()
	if camN > 0 then setCam(0); return end
	if not btnUse:GetAttribute("On") then return end
	if me.useTarget == "desk" then
		if TU:GetAttribute("Sabotage") ~= "Comms" then setCam(1) end
	else
		Net:FireServer("Use")
	end
end
local function doReport() if btnReport:GetAttribute("On") then Net:FireServer("Report") end end
local function doKill() if btnKill:GetAttribute("On") then Net:FireServer("Kill") end end
local function doVent() if btnVent:GetAttribute("On") then Net:FireServer("Vent") end end
local function doExit() if btnExit:GetAttribute("On") then Net:FireServer("VentExit") end end
local function doSab() if btnSab:GetAttribute("On") then sabMenu.Visible = not sabMenu.Visible end end
btnUse.Activated:Connect(doUse); btnReport.Activated:Connect(doReport); btnKill.Activated:Connect(doKill)
btnVent.Activated:Connect(doVent); btnExit.Activated:Connect(doExit); btnSab.Activated:Connect(doSab)
local KEYS = { [Enum.KeyCode.E] = doUse, [Enum.KeyCode.R] = doReport, [Enum.KeyCode.Q] = doKill,
	[Enum.KeyCode.V] = doVent, [Enum.KeyCode.X] = doExit, [Enum.KeyCode.F] = doSab }
UIS.InputBegan:Connect(function(input, processed)
	if processed then return end
	local f = KEYS[input.KeyCode]
	if f and TU:GetAttribute("Phase") == "Roam" then f() end
	if input.KeyCode == Enum.KeyCode.M and TU:GetAttribute("Phase") == "Roam" then toggleMap() end
	if input.KeyCode == Enum.KeyCode.E and TU:GetAttribute("Phase") == "Lobby" then
		local pos = myPos()
		if wardrobe.Visible then openWardrobe(false) elseif pos and nearLaptop(pos) then openWardrobe(true) end
	end
	local n = input.KeyCode.Value - Enum.KeyCode.One.Value + 1
	if camN > 0 and n >= 1 and n <= 4 then setCam(n) end
	if input.KeyCode == Enum.KeyCode.Slash and meeting.Visible then task.defer(function() chatInput:CaptureFocus() end) end
end)

-- ---------- phases ----------
local lastPhase = nil
local function showPhase()
	local phase = TU:GetAttribute("Phase")
	lobby.Visible = phase == "Lobby" or phase == "Countdown"
	countdown.Visible = phase == "Countdown"
	roleCard.Visible = phase == "Reveal"
	hud.Visible = phase == "Roam"
	banner.Visible = phase == "Alert"
	meeting.Visible = phase == "Discuss" or phase == "Vote" or phase == "Results"
	eject.Visible = phase == "Eject"
	over.Visible = phase == "GameOver"
	if phase ~= "Roam" then closePanel(); sabMenu.Visible = false; toggleMap(false); if camN > 0 then setCam(0) end end
	if phase == "Vote" then me.voted = false; setSelected(nil) end
	if phase == "Roam" then
		if lastPhase == "Reveal" then me.killReadyAt = now() + 10; me.sabotageReadyAt = now() + 30 -- matches the server's opening cooldown
		elseif lastPhase == "Eject" then me.killReadyAt = now() + R("killCooldown"); me.sabotageReadyAt = now() + 10 end
	end
	if phase == "Lobby" then
		me.role, me.partners, me.tasks = "Crewmate", {}, {}
		drawTasks()
	end
	lastPhase = phase
end
TU:GetAttributeChangedSignal("Phase"):Connect(showPhase)
TU:GetAttributeChangedSignal("Sabotage"):Connect(drawTasks)

-- ---------- net ----------
Net.OnClientEvent:Connect(function(kind, d)
	if kind == "Role" then
		me.role = d.role
		me.partners = {}
		for _, id in ipairs(d.impostors or {}) do me.partners[id] = true end
		local imp = d.role == "Impostor"
		roleTitle.Text = imp and "Impostor" or "Crewmate"
		roleTitle.TextColor3 = imp and RED or Color3.fromRGB(120, 220, 255)
		local partnerNames = {}
		for _, m in ipairs(CS:GetTagged("Crewmate")) do
			local id = m:GetAttribute("TUId")
			if me.partners[id] and m ~= player.Character then table.insert(partnerNames, m:GetAttribute("DisplayName")) end
		end
		roleSub.Text = imp and (#partnerNames > 0 and (table.concat(partnerNames, " and ") .. " is also an Impostor.") or "Kill everyone. Don't get caught.")
			or (d.count == 1 and "There is 1 Impostor among us" or ("There are " .. d.count .. " Impostors among us"))
		for _, c in ipairs(roleRow:GetChildren()) do if c:IsA("GuiObject") then c:Destroy() end end
		for _, m in ipairs(CS:GetTagged("Crewmate")) do
			if not imp or me.partners[m:GetAttribute("TUId")] then
				local s = swatch(suitColor(m:GetAttribute("Suit")), 50, roleRow); s.ZIndex = 12
			end
		end
		btnKill.Visible, btnVent.Visible, btnSab.Visible, btnExit.Visible = imp, imp, imp, imp
		drawTasks()
	elseif kind == "Tasks" then
		me.tasks = d
		drawTasks()
	elseif kind == "OpenTask" then
		d.openedAt = os.clock()
		task.spawn(openPanel, d)
	elseif kind == "Alert" then
		local body = d.kind == "Body"
		bannerText.Text = body and "DEAD BODY REPORTED" or "EMERGENCY MEETING"
		bannerSub.Text = d.by .. (body and " found a body" or " called a meeting")
		banner.BackgroundColor3 = body and Color3.fromRGB(120, 0, 0) or Color3.fromRGB(150, 70, 0)
		banner.Visible = true
	elseif kind == "MeetingStart" then
		me.roster = d.roster
		buildRows(d.roster)
	elseif kind == "Voted" then
		local row = rows[d.id]
		if row then row.voted.Visible = true end
	elseif kind == "VoteResults" then
		local suitOf = {}
		for _, r in ipairs(me.roster) do suitOf[r.id] = r.suit end
		for voter, target in pairs(d.votes) do
			local strip = (target == "skip") and skipVotes or (rows[target] and rows[target].strip)
			if strip then local s = swatch(suitColor(suitOf[voter]), 20, strip); s.ZIndex = 9 end
		end
	elseif kind == "Chat" then
		addChat(d.from, d.suit, d.text, d.ghost)
	elseif kind == "Eject" then
		ejectText.Text = ""; ejectSub.Text = ""
		ejectBean.Visible = d.suit ~= nil
		if d.suit then
			ejectBean.BackgroundColor3 = suitColor(d.suit)
			ejectBean.Position = UDim2.new(-0.1, 0, 0.35, 0); ejectBean.Rotation = 0
			TweenService:Create(ejectBean, TweenInfo.new(R("ejectionTime") - 0.5, Enum.EasingStyle.Linear),
				{ Position = UDim2.new(1.05, 0, 0.32, 0), Rotation = 720 }):Play()
		end
		task.spawn(function()
			for i = 1, #d.text do
				if not eject.Visible and i > 1 then return end
				ejectText.Text = d.text:sub(1, i)
				task.wait(0.05)
			end
			task.wait(0.4)
			ejectSub.Text = d.sub
		end)
	elseif kind == "GameOver" then
		local won = (d.winner == "Impostors") == (me.role == "Impostor")
		overTitle.Text = won and "VICTORY" or "DEFEAT"
		overTitle.TextColor3 = won and BLUE or RED
		overSub.Text = d.reason
		local names = {}
		for _, imp in ipairs(d.impostors) do table.insert(names, imp.name) end
		overImps.Text = (#names == 1 and "The Impostor was " or "The Impostors were ") .. table.concat(names, " and ")
	elseif kind == "YouDied" then
		diedText.TextColor3 = suitColor(d.suit)
		closePanel(); toggleMap(false); if camN > 0 then setCam(0) end
		died.Visible = true
		playDeath(d.killer, d.clip)
		task.delay(2.6, function() died.Visible = false end)
	elseif kind == "Kill" then
		local c = myChar()
		if c and d.killer == c:GetAttribute("TUId") then me.killReadyAt = now() + R("killCooldown") end
	end
end)

-- ---------- frame ----------
RunService.RenderStepped:Connect(function(dt)
	local phase = TU:GetAttribute("Phase")
	local t = now()
	local left = math.max(0, math.ceil((TU:GetAttribute("PhaseEnds") or 0) - t))

	if phase == "Lobby" or phase == "Countdown" then
		local n = #CS:GetTagged("Crewmate")
		lobbyInfo.Text = n .. " in the ship  ·  bots fill to " .. R("botFillTo")
		btnStart.Visible = phase == "Lobby"
		countdown.Text = tostring(left)
	elseif phase == "Discuss" then
		meetTimer.Text = "Voting begins in: " .. left .. "s"
	elseif phase == "Vote" then
		meetTimer.Text = "Voting ends in: " .. left .. "s"
	elseif phase == "Results" then
		meetTimer.Text = "Proceeding in: " .. left .. "s"
	end

	-- task bar
	local done, total = TU:GetAttribute("TaskDone") or 0, TU:GetAttribute("TaskTotal") or 0
	local comms = TU:GetAttribute("Sabotage") == "Comms"
	barFill.Size = UDim2.fromScale((total > 0 and not comms) and done / total or 0, 1)

	-- alarm
	local sab = TU:GetAttribute("Sabotage") or ""
	if sab ~= "" and phase == "Roam" then
		local ends = TU:GetAttribute("SabotageEnds") or 0
		local secs = math.max(0, math.ceil(ends - t))
		alarm.Visible = true
		alarm.Text = (sab == "Reactor" and ("Reactor Meltdown in " .. secs)) or (sab == "O2" and ("Oxygen Depleted in " .. secs))
			or (sab == "Lights" and "Fix Lights") or "Comms Sabotaged"
		local critical = sab == "Reactor" or sab == "O2"
		flash.BackgroundTransparency = critical and (0.75 + 0.2 * math.abs(math.sin(t * 3))) or 1
	else
		alarm.Visible = false
		flash.BackgroundTransparency = 1
	end

	-- buttons
	if phase == "Roam" then
		local pos = myPos()
		local alive = me.alive()
		local c = myChar()
		local venting = c and c:GetAttribute("Venting")
		local imp = me.role == "Impostor"
		if pos then
			local critical = sab == "Reactor" or sab == "O2"
			local onButton = alive and flat(Map.Props.EmergencyButton.Position, pos) <= R("useRange") + 1.5 and not critical
			local serverUse = (alive and nearbyFix(pos) ~= nil) or onButton or nearbyTaskPad(pos) ~= nil
			me.useTarget = serverUse and "server" or (alive and nearDesk(pos) and "desk") or nil
			setOn(btnUse, camN > 0 or (not venting and me.useTarget ~= nil))
			-- leaving the desk, or Comms going down, switches the cameras off
			if camN > 0 and (not nearDesk(pos) or sab == "Comms") then setCam(0) end
			setOn(btnReport, alive and not venting and nearbyBody(pos) ~= nil)
			if imp then
				local kcd = math.max(0, math.ceil(me.killReadyAt - t))
				killCD.Text = kcd > 0 and tostring(kcd) or ""
				btnKill.Text = kcd > 0 and "" or "KILL" -- the number replaces the label, never sits on it
				setOn(btnKill, alive and not venting and kcd == 0 and nearbyVictim(pos) ~= nil)
				setOn(btnVent, alive and (venting or nearbyVent(pos) ~= nil))
				btnVent.Text = venting and "NEXT" or "VENT"
				setOn(btnExit, venting == true)
				local scd = math.max(0, math.ceil(me.sabotageReadyAt - t))
				sabCD.Text = scd > 0 and tostring(scd) or ""
				btnSab.Text = scd > 0 and "" or "SABOTAGE"
				setOn(btnSab, sab == "" and (scd == 0 or now() >= me.doorsReadyAt))
			end
		end
	end

end)

-- ---------- first person, per frame ----------
local function padOf(id)
	for _, pad in ipairs(Map.Tasks:GetChildren()) do if pad:GetAttribute("TaskId") == id then return pad end end
end
-- where the arrow points: an unfixed sabotage pad first (red), else the nearest unfinished task (yellow)
local function arrowTarget(pos)
	local sab = TU:GetAttribute("Sabotage") or ""
	local best, bd, red = nil, math.huge, false
	if sab ~= "" and me.alive() then
		for _, f in ipairs(Map.FixPads:GetChildren()) do
			if f:GetAttribute("Kind") == sab and not f:GetAttribute("Fixed") and flat(f.Position, pos) < bd then best, bd, red = f, flat(f.Position, pos), true end
		end
		if best then return best.Position, true end
	end
	if sab == "Comms" and me.role ~= "Impostor" then return nil end
	for _, t in ipairs(me.tasks) do
		local pad = not t.done and padOf(t.id)
		if pad and flat(pad.Position, pos) < bd then best, bd = pad, flat(pad.Position, pos) end
	end
	return best and best.Position, red
end

-- your unfinished tasks' consoles get a yellow outline (Among Us does the same); the Shields hex wall
-- lights up once you have primed the shields
local taskGlow = {}
local shieldsLit = nil
local function updateTaskGlow(phase)
	local want = {}
	local sab = TU:GetAttribute("Sabotage") or ""
	local primed = false
	for _, t in ipairs(me.tasks) do
		if t.done and t.task == "Prime Shields" then primed = true end
		local pad = phase == "Roam" and not t.done and not (sab == "Comms" and me.role ~= "Impostor") and padOf(t.id)
		if pad then want[pad:FindFirstChild("Console") or pad] = true end
	end
	for inst, h in pairs(taskGlow) do
		if not want[inst] then h:Destroy(); taskGlow[inst] = nil end
	end
	for inst in pairs(want) do
		if not taskGlow[inst] then
			local h = Instance.new("Highlight")
			h.FillTransparency = 1; h.OutlineColor = Color3.fromRGB(255, 220, 60); h.OutlineTransparency = 0
			h.DepthMode = Enum.HighlightDepthMode.Occluded; h.Adornee = inst; h.Parent = inst
			taskGlow[inst] = h
		end
	end
	if primed ~= shieldsLit then
		shieldsLit = primed
		local decor = Map:FindFirstChild("Decor")
		local shields = decor and decor:FindFirstChild("Shields")
		for _, p in ipairs(shields and shields:GetChildren() or {}) do
			if p.Name == "Hex" then
				p.Material = primed and Enum.Material.Neon or Enum.Material.SmoothPlastic
				p.Color = primed and Color3.fromRGB(90, 150, 255) or Color3.fromRGB(60, 78, 120)
			end
		end
	end
end

local uiOpen = nil
RunService.RenderStepped:Connect(function()
	local phase = TU:GetAttribute("Phase")
	local cam = workspace.CurrentCamera
	local c = myChar()
	local pos = myPos()

	-- tell the client when the mouse must be free
	local open = panel.Visible or sabMenu.Visible or mapFrame.Visible or meeting.Visible or wardrobe.Visible
	laptopHint.Visible = phase == "Lobby" and pos ~= nil and nearLaptop(pos) and not wardrobe.Visible
	if open ~= uiOpen then uiOpen = open; player:SetAttribute("UIOpen", open) end

	-- the goggle frame: your suit, a shade darker, round the edge of your eyes
	local fp = (phase == "Roam" or phase == "Lobby" or phase == "Countdown") and camN == 0
	lipFrame.Visible, ringFrame.Visible, dot.Visible = fp, fp, fp and not open
	if c then
		local s = suitColor(c:GetAttribute("Suit"))
		lipStroke.Color = Color3.new(s.R * 0.72, s.G * 0.72, s.B * 0.72)
	end
	ventGrate.Visible = phase == "Roam" and c ~= nil and c:GetAttribute("Venting") == true
	altHint.Visible = phase == "Roam" and UIS.KeyboardEnabled and not UIS.TouchEnabled and not open and camN == 0

	-- map markers
	if mapFrame.Visible and mapMarks and pos then
		-- a pool of dots, moved every frame: a frame created and destroyed each frame never gets drawn
		local used = 0
		local pool = mapMarks:GetChildren()
		local function mark(p, color, size)
			used += 1
			local f = pool[used]
			if not f then
				f = round(new("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), BorderSizePixel = 0, ZIndex = 36 }, mapMarks), 7)
				pool[used] = f
			end
			f.Visible = true
			f.Position = mapPos(p); f.Size = UDim2.fromOffset(size, size); f.BackgroundColor3 = color
		end
		local sab = TU:GetAttribute("Sabotage") or ""
		if not (sab == "Comms" and me.role ~= "Impostor") then
			for _, t in ipairs(me.tasks) do
				local pad = not t.done and padOf(t.id)
				if pad then mark(pad.Position, Color3.fromRGB(255, 220, 60), 10) end
			end
		end
		if sab ~= "" and math.floor(now() * 3) % 2 == 0 then
			for _, f in ipairs(Map.FixPads:GetChildren()) do
				if f:GetAttribute("Kind") == sab and not f:GetAttribute("Fixed") then mark(f.Position, RED, 14) end
			end
		end
		for i = used + 1, #pool do pool[i].Visible = false end
		local look = cam.CFrame.LookVector
		mapMe.Position = mapPos(pos)
		mapMe.Rotation = math.deg(math.atan2(look.X, -look.Z)) -- 0 = facing -Z = up on the map
		mapMe.TextColor3 = suitColor(c and c:GetAttribute("Suit"))
	end

	updateTaskGlow(phase)

	-- task arrow: a marker over the target when it is on screen, an arrow at the edge when it is not
	local target, isRed
	if phase == "Roam" and pos and camN == 0 and not open and not (c and c:GetAttribute("Venting")) then target, isRed = arrowTarget(pos) end
	arrow.Visible = target ~= nil
	if target then
		arrow.TextColor3 = isRed and RED or Color3.fromRGB(255, 220, 60)
		local sp = cam:WorldToViewportPoint(target + Vector3.new(0, 2.5, 0))
		local vp = cam.ViewportSize
		local m = 60
		if sp.Z > 0 and sp.X > m and sp.X < vp.X - m and sp.Y > m and sp.Y < vp.Y - m then
			arrow.Text = "▼"; arrow.Rotation = 0
			arrow.Position = UDim2.fromOffset(sp.X, sp.Y)
		else
			local d = Vector2.new(sp.X - vp.X / 2, sp.Y - vp.Y / 2)
			if sp.Z < 0 then d = -d end
			if d.Magnitude < 1 then d = Vector2.new(0, -1) end
			local k = math.min((vp.X / 2 - m) / math.max(math.abs(d.X), 1e-3), (vp.Y / 2 - m) / math.max(math.abs(d.Y), 1e-3))
			local e = Vector2.new(vp.X / 2, vp.Y / 2) + d * k
			arrow.Text = "▲"
			arrow.Rotation = math.deg(math.atan2(d.Y, d.X)) + 90
			arrow.Position = UDim2.fromOffset(e.X, e.Y)
		end
	end
end)

showPhase()
drawTasks()
