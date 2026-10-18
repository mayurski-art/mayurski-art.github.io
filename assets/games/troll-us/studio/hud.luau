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

local died = card("Died")
died.BackgroundTransparency = 0.2
local diedText = label({ AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.45), Size = UDim2.fromOffset(800, 100),
	Font = BLACK, TextSize = 64, ZIndex = 11, Text = "You were killed" }, died)

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

-- ---------- task panel ----------
local panel = round(outline(new("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5),
	Size = UDim2.fromOffset(420, 250), BackgroundColor3 = Color3.fromRGB(46, 50, 62), Visible = false, ZIndex = 20 }, gui), 4), 16)
local panelTitle = label({ Size = UDim2.new(1, 0, 0, 44), Position = UDim2.fromOffset(0, 14), Font = BLACK, TextSize = 26, ZIndex = 21 }, panel)
local panelRoom = label({ Size = UDim2.new(1, 0, 0, 22), Position = UDim2.fromOffset(0, 56), TextSize = 16, TextColor3 = Color3.fromRGB(180, 186, 200), ZIndex = 21 }, panel)
local holdBtn = round(outline(new("TextButton", { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 100),
	Size = UDim2.fromOffset(240, 60), BackgroundColor3 = Color3.fromRGB(240, 200, 60), Text = "HOLD", Font = BLACK, TextSize = 24,
	TextColor3 = INK, ZIndex = 21, AutoButtonColor = false }, panel), 3), 12)
local holdBar = round(new("Frame", { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 182), Size = UDim2.fromOffset(300, 18),
	BackgroundColor3 = Color3.fromRGB(26, 28, 36), ZIndex = 21 }, panel), 9)
local holdFill = round(new("Frame", { Size = UDim2.fromScale(0, 1), BackgroundColor3 = GREEN, ZIndex = 22 }, holdBar), 9)
local panelClose = round(new("TextButton", { AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -10, 0, 10), Size = UDim2.fromOffset(34, 34),
	BackgroundColor3 = RED, Text = "X", Font = BLACK, TextSize = 18, TextColor3 = WHITE, ZIndex = 22 }, panel), 17)
local openTask, holding, held = nil, false, 0
local function closePanel() panel.Visible = false; openTask = nil; holding = false; held = 0; holdFill.Size = UDim2.fromScale(0, 1) end
panelClose.Activated:Connect(closePanel)
holdBtn.InputBegan:Connect(function(i)
	if i.UserInputType == Enum.UserInputType.MouseButton1 or i.UserInputType == Enum.UserInputType.Touch then holding = true end
end)
holdBtn.InputEnded:Connect(function(i)
	if i.UserInputType == Enum.UserInputType.MouseButton1 or i.UserInputType == Enum.UserInputType.Touch then holding = false end
end)

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
local function nearbyBody(pos)
	for _, b in ipairs(Bodies:GetChildren()) do
		if flat(b:GetPivot().Position, pos) <= R("reportRange") then return b end
	end
end
local function nearbyVictim(pos)
	for _, m in ipairs(CS:GetTagged("Crewmate")) do
		if m ~= myChar() and m:GetAttribute("Alive") ~= false and not me.partners[m:GetAttribute("TUId")] then
			local h = m:FindFirstChild("HumanoidRootPart")
			if h and flat(h.Position, pos) <= R("killRange") then return m end
		end
	end
end
local function nearbyVent(pos)
	for _, v in ipairs(Map.Vents:GetChildren()) do
		if flat(v.Position, pos) <= R("ventRange") then return v end
	end
end

-- ---------- actions ----------
local function doUse() if btnUse:GetAttribute("On") then Net:FireServer("Use") end end
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
	if phase ~= "Roam" then closePanel(); sabMenu.Visible = false end
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
		openTask = d
		panelTitle.Text = d.task
		panelRoom.Text = d.room
		held = 0; holding = false
		holdFill.Size = UDim2.fromScale(0, 1)
		panel.Visible = true
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
		died.Visible = true
		task.delay(2.5, function() died.Visible = false end)
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
			setOn(btnUse, not venting and ((alive and nearbyFix(pos) ~= nil) or onButton or nearbyTaskPad(pos) ~= nil))
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

	-- task hold
	if openTask and panel.Visible then
		if holding then held += dt else held = math.max(0, held - dt * 2) end
		holdFill.Size = UDim2.fromScale(math.clamp(held / openTask.hold, 0, 1), 1)
		if held >= openTask.hold then
			Net:FireServer("TaskDone", openTask.id)
			closePanel()
		end
	end
end)

showPhase()
drawTasks()
