-- TrollUsServer (ServerScriptService): the round state machine.
-- Phases: Lobby > Countdown > Reveal > Roam > Alert > Discuss > Vote > Results > Eject > Roam ... > GameOver > Lobby
-- Public state lives in attributes on ReplicatedStorage.TrollUs; private state goes to one client over Net.
local Players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local CS = game:GetService("CollectionService")
local PhysicsService = game:GetService("PhysicsService")
local TextService = game:GetService("TextService")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")

local TU = RS:WaitForChild("TrollUs")
local Rules = require(TU:WaitForChild("Rules"))
local Hats = require(TU:WaitForChild("Hats"))
local Net = TU:WaitForChild("Net")
local Root = workspace:WaitForChild("TrollUs")
local Map = Root:WaitForChild("Map")
local Bots = require(script:WaitForChild("Bots"))

local function R(k)
	local v = TU:GetAttribute(k)
	if v ~= nil then return v end
	return Rules[k]
end
local function now() return workspace:GetServerTimeNow() end
local function flat(a, b) return Vector3.new(a.X - b.X, 0, a.Z - b.Z).Magnitude end

-- ---------- world setup ----------
local function folder(parent, name)
	local f = parent:FindFirstChild(name)
	if not f then f = Instance.new("Folder"); f.Name = name; f.Parent = parent end
	return f
end
local BotsFolder = folder(Root, "Bots")
local Bodies = folder(Root, "Bodies")
BotsFolder:ClearAllChildren(); Bodies:ClearAllChildren()

for _, g in ipairs({ "TUWalls", "TUCrew", "TUGhost" }) do
	pcall(function() PhysicsService:RegisterCollisionGroup(g) end)
end
PhysicsService:CollisionGroupSetCollidable("TUCrew", "TUCrew", false)   -- crewmates walk through each other
PhysicsService:CollisionGroupSetCollidable("TUGhost", "TUWalls", false) -- ghosts walk through walls
PhysicsService:CollisionGroupSetCollidable("TUGhost", "TUCrew", false)
PhysicsService:CollisionGroupSetCollidable("TUGhost", "TUGhost", false)
for _, f in ipairs({ Map.Walls, Map.Doors }) do
	for _, p in ipairs(f:GetChildren()) do p.CollisionGroup = "TUWalls" end
end
-- room props block crewmates but not ghosts
local decor = Map:FindFirstChild("Decor")
for _, p in ipairs(decor and decor:GetDescendants() or {}) do
	if p:IsA("BasePart") then p.CollisionGroup = "TUWalls" end
end
-- the security cameras sit at head height and snag beans in the halls; places built before the fix still collide
for _, d in ipairs(Map.Cameras:GetDescendants()) do
	if d:IsA("BasePart") then d.CanCollide = false; d.CanQuery = false end
end

local Pads = {}      -- TaskId -> pad
for _, p in ipairs(Map.Tasks:GetChildren()) do Pads[p:GetAttribute("TaskId")] = p end
local Vents = Map.Vents:GetChildren()
local Button = Map.Props.EmergencyButton
local TABLE = Vector3.new(0, 0, -30)

Players.RespawnTime = 1e6

-- ---------- state ----------
local S = {
	phase = "Lobby", gen = 0,
	parts = {}, order = {},
	votes = {},
	sabotage = nil, sabotageReady = 0, doorsReady = 0,
	emergencyReady = 0,
	nextBot = 1,
}

local function setPhase(p, dur)
	S.gen += 1
	S.phase = p
	TU:SetAttribute("Phase", p)
	TU:SetAttribute("PhaseEnds", dur and (now() + dur) or 0)
	return S.gen
end
local function after(dur, gen, fn)
	task.delay(dur, function() if S.gen == gen then fn() end end)
end

local function list()
	local out = {}
	for _, id in ipairs(S.order) do if S.parts[id] then table.insert(out, S.parts[id]) end end
	return out
end
local function hrpOf(p) return p.model and p.model:FindFirstChild("HumanoidRootPart") end
local function posOf(p) local h = hrpOf(p); return h and h.Position end
local function humOf(p) return p.model and p.model:FindFirstChildOfClass("Humanoid") end
local function sendTo(p, ...) if p.player then Net:FireClient(p.player, ...) end end
local function broadcast(...) Net:FireAllClients(...) end

local function setAttr(p, k, v) p[k == "Alive" and "alive" or k] = v; if p.model then p.model:SetAttribute(k, v) end end

-- ---------- looks ----------
local SUITS = RS:WaitForChild("TrollUsSuits")
local function paint(model, suit)
	local c = SUITS[suit].Value
	for _, d in ipairs(model:GetDescendants()) do
		if d:IsA("BasePart") and d.Name ~= "Face" and d.Name ~= "HumanoidRootPart" then
			-- SuitShade: 0 keeps the part's own colour (the visor's dark ring), else a multiple of the suit (the darker lip)
			local k = d:GetAttribute("SuitShade") or 1
			if k > 0 then d.Color = Color3.new(c.R * k, c.G * k, c.B * k) end
		end
	end
end
local function setGroup(model, g)
	for _, d in ipairs(model:GetDescendants()) do if d:IsA("BasePart") then d.CollisionGroup = g end end
end
local GHOST_HIDE = { LegL = true, LegR = true, Heel = true }
local function ghostify(p, on)
	if not p.model then return end
	setGroup(p.model, on and "TUGhost" or "TUCrew")
	for _, d in ipairs(p.model:GetDescendants()) do
		if d:IsA("BasePart") and GHOST_HIDE[d.Name] then d.Transparency = on and 1 or 0 end
		if d:IsA("BasePart") and d.Name == "GhostTail" then d.Transparency = on and 0 or 1 end -- legs go, a wisp of tail shows
	end
	p.model:SetAttribute("Alive", not on)
end
local function nameTag(model, name)
	local hrp = model:WaitForChild("HumanoidRootPart")
	local old = hrp:FindFirstChild("Tag"); if old then old:Destroy() end
	local bb = Instance.new("BillboardGui"); bb.Name = "Tag"; bb.Size = UDim2.new(0, 140, 0, 22)
	-- not AlwaysOnTop: in first person a name must not show through a wall
	bb.StudsOffset = Vector3.new(0, 3.6, 0); bb.AlwaysOnTop = false; bb.LightInfluence = 0
	local t = Instance.new("TextLabel"); t.Name = "Name"; t.Size = UDim2.fromScale(1, 1); t.BackgroundTransparency = 1
	t.Text = name; t.Font = Enum.Font.GothamBold; t.TextSize = 15; t.TextColor3 = Color3.new(1, 1, 1)
	t.TextStrokeTransparency = 0.2; t.Parent = bb
	bb.Parent = hrp
end
local function dress(p)
	local m = p.model
	m:SetAttribute("TUId", p.id); m:SetAttribute("DisplayName", p.name); m:SetAttribute("Suit", p.suit)
	m:SetAttribute("Alive", p.alive ~= false); m:SetAttribute("Venting", false)
	paint(m, p.suit); Hats.wear(m, p.hat); setGroup(m, "TUCrew"); nameTag(m, p.name)
	CS:AddTag(m, "Crewmate")
	local hum = m:FindFirstChildOfClass("Humanoid")
	if hum then hum.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None end
	if p.alive == false then ghostify(p, true) end
end

local function freeSuit()
	local used = {}
	for _, p in pairs(S.parts) do used[p.suit] = true end
	for _, s in ipairs(Rules.suits) do if not used[s] then return s end end
	return Rules.suits[math.random(#Rules.suits)]
end

local function newPart(id, name, isBot)
	-- bots pick a hat now and then; humans choose theirs in the lobby wardrobe
	local hat = (isBot and math.random() < 0.6) and Hats.LIST[math.random(2, #Hats.LIST)] or "None"
	return { id = id, name = name, isBot = isBot, suit = freeSuit(), hat = hat, role = "Crewmate", alive = true,
		tasks = {}, killReady = 0, meetings = 1, sus = {}, venting = nil, openTask = nil }
end

local function moveTo(p, pos)
	local m = p.model; if not m then return end
	m:PivotTo(CFrame.new(pos.X, 2.8, pos.Z) * CFrame.Angles(0, math.pi, 0))
end
local function ringSpot(i, n, radius)
	local a = (i - 1) / math.max(n, 1) * math.pi * 2
	return TABLE + Vector3.new(math.cos(a) * radius, 0, math.sin(a) * radius)
end

local function setFrozen(p, frozen)
	local hum = humOf(p)
	if hum then hum.WalkSpeed = frozen and 0 or (p.isBot and R("botWalkSpeed") or R("walkSpeed")) end
end

-- ---------- humans ----------
local function addHuman(player)
	local id = "p" .. player.UserId
	if S.parts[id] then return end
	local p = newPart(id, player.DisplayName, false)
	p.player = player
	S.parts[id] = p; table.insert(S.order, id)
	local function onChar(char)
		p.model = char
		char:WaitForChild("HumanoidRootPart")
		dress(p)
		if S.phase ~= "Lobby" and S.phase ~= "Countdown" and p.alive == false then ghostify(p, true) end
	end
	player.CharacterAdded:Connect(onChar)
	if player.Character then task.spawn(onChar, player.Character) end
end
Players.PlayerAdded:Connect(addHuman)
for _, pl in ipairs(Players:GetPlayers()) do addHuman(pl) end
Players.PlayerRemoving:Connect(function(player)
	local id = "p" .. player.UserId
	S.parts[id] = nil
	for i, v in ipairs(S.order) do if v == id then table.remove(S.order, i); break end end
end)

-- ---------- bots ----------
local function addBot()
	local id = "b" .. S.nextBot
	local name = Rules.botNames[((S.nextBot - 1) % #Rules.botNames) + 1]
	S.nextBot += 1
	local p = newPart(id, name, true)
	local m = game.StarterPlayer.StarterCharacter:Clone()
	m.Name = name
	local hrp = m.HumanoidRootPart
	local att = Instance.new("Attachment"); att.Name = "TUAlign"; att.Parent = hrp
	local ao = Instance.new("AlignOrientation"); ao.Name = "Face"; ao.Mode = Enum.OrientationAlignmentMode.OneAttachment
	ao.Attachment0 = att; ao.RigidityEnabled = true; ao.CFrame = CFrame.Angles(0, math.pi, 0); ao.Parent = hrp
	p.model = m
	m:PivotTo(CFrame.new(ringSpot(#S.order + 1, 10, 13)) * CFrame.Angles(0, math.pi, 0) + Vector3.new(0, 2.8, 0))
	m.Parent = BotsFolder
	pcall(function() hrp:SetNetworkOwner(nil) end)
	S.parts[id] = p; table.insert(S.order, id)
	dress(p)
	setFrozen(p, false)
	return p
end

-- ---------- tasks ----------
local function updateProgress()
	local done, total = 0, 0
	for _, p in ipairs(list()) do
		if p.role == "Crewmate" then
			for _, t in ipairs(p.tasks) do
				total += 1
				if t.done then done += 1 end
			end
		end
	end
	TU:SetAttribute("TaskDone", done); TU:SetAttribute("TaskTotal", total)
	return done, total
end
local function sendTasks(p)
	if not p.player then return end
	local out = {}
	for _, t in ipairs(p.tasks) do
		local pad = Pads[t.id]
		table.insert(out, { id = t.id, task = pad:GetAttribute("Task"), room = pad:GetAttribute("Room"), done = t.done })
	end
	sendTo(p, "Tasks", out)
end
local function assignTasks(p)
	local ids = {}
	for id in pairs(Pads) do table.insert(ids, id) end
	for i = #ids, 2, -1 do local j = math.random(i); ids[i], ids[j] = ids[j], ids[i] end
	p.tasks = {}
	for i = 1, math.min(R("tasksPerPlayer"), #ids) do table.insert(p.tasks, { id = ids[i], done = false }) end
end

local endGame -- forward
local function checkWin()
	if S.phase == "GameOver" or S.phase == "Lobby" then return true end
	local imp, crew = 0, 0
	for _, p in ipairs(list()) do
		if p.alive then
			if p.role == "Impostor" then imp += 1 else crew += 1 end
		end
	end
	local done, total = updateProgress()
	if imp == 0 then endGame("Crewmates", "Every Impostor was voted out") return true end
	if imp >= crew then endGame("Impostors", "The Impostors outnumber the Crewmates") return true end
	if total > 0 and done >= total then endGame("Crewmates", "Every task is done") return true end
	return false
end

local function markTaskDone(p, id)
	for _, t in ipairs(p.tasks) do
		if t.id == id and not t.done then
			if p.role ~= "Crewmate" then return end -- fake tasks count for nothing
			t.done = true
			sendTasks(p)
			updateProgress()
			if S.phase == "Roam" then checkWin() end
			return true
		end
	end
end

-- ---------- sabotage ----------
local function clearSabotage()
	S.sabotage = nil
	TU:SetAttribute("Sabotage", ""); TU:SetAttribute("SabotageEnds", 0)
	for _, f in ipairs(Map.FixPads:GetChildren()) do f:SetAttribute("Fixed", false) end
end
local function startSabotage(kind)
	if S.sabotage or now() < S.sabotageReady or S.phase ~= "Roam" then return false end
	local critical = kind == "Reactor" or kind == "O2"
	S.sabotage = { kind = kind, ends = critical and (now() + R("sabotageTimer")) or 0, fixed = {} }
	TU:SetAttribute("Sabotage", kind); TU:SetAttribute("SabotageEnds", S.sabotage.ends)
	S.sabotageReady = now() + R("sabotageCooldown")
	return true
end
-- a door's Panel/Stripe/Edge children slide between their OpenCF and ShutCF; the Lamp goes red while shut
local DOOR_SLIDE = TweenInfo.new(0.45, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
local function setDoor(d, shut)
	d.CanCollide = shut
	for _, c in ipairs(d:GetChildren()) do
		local cf = c:GetAttribute(shut and "ShutCF" or "OpenCF")
		if cf then TweenService:Create(c, DOOR_SLIDE, { CFrame = cf }):Play() end
		if c.Name == "Lamp" then c.Color = shut and Color3.fromRGB(240, 50, 50) or Color3.fromRGB(60, 220, 110) end
	end
end
local function closeDoors(room)
	if now() < S.doorsReady or S.phase ~= "Roam" then return end
	S.doorsReady = now() + R("doorsCooldown")
	for _, d in ipairs(Map.Doors:GetChildren()) do
		if d:GetAttribute("Room") == room then
			setDoor(d, true)
			task.delay(R("doorsCloseTime"), function() setDoor(d, false) end)
		end
	end
end
local function openAllDoors()
	for _, d in ipairs(Map.Doors:GetChildren()) do if d.CanCollide then setDoor(d, false) end end
end
local function fixAt(p, pad)
	local s = S.sabotage
	if not s or pad:GetAttribute("Kind") ~= s.kind then return end
	s.fixed[pad:GetAttribute("Index")] = true
	pad:SetAttribute("Fixed", true)
	local need = #Rules.fixPads[s.kind]
	local n = 0
	for _ in pairs(s.fixed) do n += 1 end
	if n >= need then clearSabotage() end
end

-- ---------- kills, bodies, vents ----------
local function spawnBody(victim)
	local pos = posOf(victim); if not pos then return end
	victim.model.Archivable = true -- player characters are not archivable, and Clone() returns nil for them
	local b = victim.model:Clone()
	if not b then return end
	b.Name = "DeadBody"
	for _, d in ipairs(b:GetDescendants()) do
		if d:IsA("Humanoid") or d:IsA("Script") or d:IsA("LocalScript") or d:IsA("BillboardGui")
			or d:IsA("AlignOrientation") or d:IsA("Constraint") then d:Destroy()
		elseif d:IsA("BasePart") then d.Anchored = true; d.CanCollide = false; d.Transparency = (d.Name == "HumanoidRootPart") and 1 or 0 end
	end
	CS:RemoveTag(b, "Crewmate")
	b:SetAttribute("Of", victim.id)
	-- on its side (the bean is 3.2 wide, so its middle rests 1.6 up), one leg kicked up, still grinning
	b:PivotTo(CFrame.new(pos.X, 1.6, pos.Z) * CFrame.Angles(0, math.random() * math.pi * 2, 0) * CFrame.Angles(0, 0, math.rad(90)))
	local leg = b:FindFirstChild("LegR")
	if leg then leg.CFrame = leg.CFrame * CFrame.new(0, 0.5, 0) * CFrame.Angles(math.rad(-75), 0, 0) * CFrame.new(0, -0.5, 0) end
	local tail = b:FindFirstChild("GhostTail"); if tail then tail.Transparency = 1 end
	b.Parent = Bodies
end
local KILL_CLIPS = { "Stab", "Shoot", "Tongue" }
local function doKill(killer, victim)
	if S.phase ~= "Roam" or not killer.alive or not victim.alive or killer.venting then return end
	if killer.role ~= "Impostor" or victim.role == "Impostor" then return end
	if now() < killer.killReady then return end
	local kp, vp = posOf(killer), posOf(victim)
	if not kp or not vp or flat(kp, vp) > R("killRange") + 0.5 then return end
	victim.alive = false
	victim.openTask = nil
	killer.killReady = now() + R("killCooldown")
	-- the clip plays for ~0.7 s on every client before the body drops and the killer lands on it
	local clip = KILL_CLIPS[math.random(#KILL_CLIPS)]
	setFrozen(victim, true)
	task.delay(0.7, function()
		if S.phase ~= "Roam" then setFrozen(victim, false); return end
		spawnBody(victim)
		ghostify(victim, true)
		setFrozen(victim, false)
		if killer.alive then moveTo(killer, vp) end
		checkWin() -- after the clip, so a winning kill is seen before the end screen
	end)
	for _, w in ipairs(list()) do
		if w.isBot and w.alive and w.role == "Crewmate" and w ~= victim then
			local wp = posOf(w)
			if wp and flat(wp, vp) < 22 then w.sus[killer.id] = true end
		end
	end
	sendTo(victim, "YouDied", { suit = killer.suit, killer = killer.id, clip = clip })
	broadcast("Kill", { killer = killer.id, victim = victim.id, clip = clip, from = kp, at = vp })
end

local function ventsInGroup(g)
	local out = {}
	for _, v in ipairs(Vents) do if v:GetAttribute("Group") == g then table.insert(out, v) end end
	table.sort(out, function(a, b) return a:GetAttribute("Room") < b:GetAttribute("Room") end)
	return out
end
local function ventTo(p, v)
	p.venting = v
	local hrp = hrpOf(p)
	if hrp then hrp.Anchored = true end
	moveTo(p, v.Position)
	p.model:SetAttribute("Venting", true)
	setFrozen(p, true)
end
local function ventExit(p)
	if not p.venting then return end
	local v = p.venting
	p.venting = nil
	local hrp = hrpOf(p)
	moveTo(p, v.Position)
	if hrp then hrp.Anchored = false end
	p.model:SetAttribute("Venting", false)
	setFrozen(p, S.phase ~= "Roam")
end
local function ventUse(p)
	if S.phase ~= "Roam" or p.role ~= "Impostor" or not p.alive then return end
	if p.venting then
		local group = ventsInGroup(p.venting:GetAttribute("Group"))
		for i, v in ipairs(group) do
			if v == p.venting then ventTo(p, group[(i % #group) + 1]); return end
		end
		return
	end
	local pos = posOf(p); if not pos then return end
	for _, v in ipairs(Vents) do
		if flat(v.Position, pos) <= R("ventRange") then ventTo(p, v); return end
	end
end

-- ---------- meetings ----------
local function roster()
	local out = {}
	for _, p in ipairs(list()) do table.insert(out, { id = p.id, name = p.name, suit = p.suit, alive = p.alive }) end
	return out
end
local function sayBot(p, text)
	broadcast("Chat", { from = p.name, suit = p.suit, text = text, ghost = not p.alive })
end

local endVote -- forward
local function startVoting()
	local gen = setPhase("Vote", R("votingTime"))
	after(R("votingTime"), gen, function() endVote() end)
	for _, p in ipairs(list()) do
		if p.isBot and p.alive then
			task.delay(2 + math.random() * (R("votingTime") * 0.4), function()
				if S.gen ~= gen or S.votes[p.id] then return end
				local target = Bots.pickVote(p, list())
				S.votes[p.id] = target
				broadcast("Voted", { id = p.id })
				local all = true
				for _, q in ipairs(list()) do if q.alive and not S.votes[q.id] then all = false end end
				if all then endVote() end
			end)
		end
	end
end

local function startMeeting(caller, kind)
	Bodies:ClearAllChildren()
	S.votes = {}
	local everyone = list()
	for i, p in ipairs(everyone) do
		ventExit(p)
		p.openTask = nil
		moveTo(p, ringSpot(i, #everyone, 9))
		setFrozen(p, true)
	end
	local gen = setPhase("Discuss", R("discussionTime"))
	broadcast("MeetingStart", { roster = roster(), caller = caller.id, kind = kind })
	for _, line in ipairs(Bots.meetingLines(caller, kind, everyone)) do
		task.delay(line.t, function() if S.gen == gen or S.phase == "Vote" then sayBot(line.p, line.text) end end)
	end
	after(R("discussionTime"), gen, startVoting)
end

local function callMeeting(caller, kind)
	if S.phase ~= "Roam" or not caller.alive then return end
	clearSabotage(); openAllDoors()
	for _, p in ipairs(list()) do setFrozen(p, true) end
	local gen = setPhase("Alert", 2.5)
	broadcast("Alert", { kind = kind, by = caller.name, suit = caller.suit })
	after(2.5, gen, function() startMeeting(caller, kind) end)
end

local function resumeRoam()
	for _, p in ipairs(list()) do
		setFrozen(p, false)
		if p.role == "Impostor" then p.killReady = now() + R("killCooldown") end
	end
	S.emergencyReady = now() + R("emergencyCooldown")
	S.sabotageReady = now() + 10
	setPhase("Roam")
end

endVote = function()
	if S.phase ~= "Vote" then return end
	local counts, skip = {}, 0
	for _, target in pairs(S.votes) do
		if target == "skip" then skip += 1 else counts[target] = (counts[target] or 0) + 1 end
	end
	local best, bestN, tie = nil, 0, false
	for id, n in pairs(counts) do
		if n > bestN then best, bestN, tie = id, n, false elseif n == bestN then tie = true end
	end
	local ejected = nil
	if best and not tie and bestN > skip then ejected = S.parts[best] end
	local gen = setPhase("Results", 4)
	broadcast("VoteResults", { votes = S.votes })
	after(4, gen, function()
		local text, sub
		local impLeft = 0
		if ejected then
			ejected.alive = false
			ghostify(ejected, true)
		end
		for _, p in ipairs(list()) do if p.alive and p.role == "Impostor" then impLeft += 1 end end
		if not ejected then
			text = (tie or (best and bestN == skip)) and "No one was ejected. (Tie)" or "No one was ejected. (Skipped)"
		elseif R("confirmEjects") then
			text = ejected.name .. (ejected.role == "Impostor" and " was An Impostor." or " was not An Impostor.")
		else
			text = ejected.name .. " was ejected."
		end
		sub = impLeft == 1 and "1 Impostor remains." or (impLeft .. " Impostors remain.")
		local g2 = setPhase("Eject", R("ejectionTime"))
		broadcast("Eject", { text = text, sub = sub, suit = ejected and ejected.suit or nil, id = ejected and ejected.id or nil })
		after(R("ejectionTime"), g2, function()
			if not checkWin() then resumeRoam() end
		end)
	end)
end

-- ---------- game flow ----------
local function resetToLobby()
	Bodies:ClearAllChildren()
	clearSabotage(); openAllDoors()
	local everyone = list()
	for i, p in ipairs(everyone) do
		ventExit(p)
		p.alive = true; p.role = "Crewmate"; p.tasks = {}; p.sus = {}; p.openTask = nil
		ghostify(p, false)
		moveTo(p, ringSpot(i, #everyone, 13))
		setFrozen(p, false)
		sendTo(p, "Tasks", {})
	end
	updateProgress()
	setPhase("Lobby")
end

endGame = function(winner, reason)
	local imps = {}
	for _, p in ipairs(list()) do if p.role == "Impostor" then table.insert(imps, { name = p.name, suit = p.suit }) end end
	clearSabotage()
	for _, p in ipairs(list()) do ventExit(p); setFrozen(p, true) end
	local gen = setPhase("GameOver", R("gameOverTime"))
	broadcast("GameOver", { winner = winner, reason = reason, impostors = imps })
	after(R("gameOverTime"), gen, resetToLobby)
end

local function startGame()
	-- fill with bots up to botFillTo (never past maxPlayers)
	while #list() < math.min(R("botFillTo"), R("maxPlayers")) do addBot() end
	local everyone = list()
	if #everyone < R("minPlayers") then return end
	for i, p in ipairs(everyone) do
		p.alive = true; p.role = "Crewmate"; p.sus = {}; p.meetings = R("emergencyMeetings"); p.openTask = nil
		p.killReady = now() + 10
		ghostify(p, false)
		assignTasks(p)
		moveTo(p, ringSpot(i, #everyone, 13))
		setFrozen(p, true)
	end
	-- impostors: a forced pick for tests via attribute ForceImpostor = TUId
	local pool = table.clone(everyone)
	local nImp = Rules.impostorsFor(#everyone)
	local forced = TU:GetAttribute("ForceImpostor")
	local imps = {}
	if forced and forced ~= "" and S.parts[forced] then
		table.insert(imps, S.parts[forced])
		for i, p in ipairs(pool) do if p.id == forced then table.remove(pool, i); break end end
	end
	if forced == "none-human" then
		for i = #pool, 1, -1 do if not pool[i].isBot then table.remove(pool, i) end end
	end
	while #imps < nImp and #pool > 0 do
		table.insert(imps, table.remove(pool, math.random(#pool)))
	end
	for _, p in ipairs(imps) do p.role = "Impostor" end
	local partners = {}
	for _, p in ipairs(imps) do table.insert(partners, p.id) end
	for _, p in ipairs(everyone) do
		sendTo(p, "Role", { role = p.role, impostors = p.role == "Impostor" and partners or {}, count = #imps })
		sendTasks(p)
	end
	S.emergencyReady = now() + R("emergencyCooldown")
	S.sabotageReady = now() + 30
	updateProgress()
	local gen = setPhase("Reveal", R("roleRevealTime"))
	after(R("roleRevealTime"), gen, function()
		for _, p in ipairs(list()) do setFrozen(p, false) end
		setPhase("Roam")
	end)
end

-- ---------- intents from clients ----------
local function nearestPad(p, pos)
	for _, t in ipairs(p.tasks) do
		if not t.done then
			local pad = Pads[t.id]
			if pad and flat(pad.Position, pos) <= R("useRange") then return t end
		end
	end
end
local function use(p)
	local pos = posOf(p); if not pos then return end
	if S.phase ~= "Roam" then return end
	if S.sabotage and p.alive then
		for _, f in ipairs(Map.FixPads:GetChildren()) do
			if f:GetAttribute("Kind") == S.sabotage.kind and flat(f.Position, pos) <= R("useRange") then
				fixAt(p, f); return
			end
		end
	end
	if p.alive and flat(Button.Position, pos) <= R("useRange") + 1.5 then
		local critical = S.sabotage and (S.sabotage.kind == "Reactor" or S.sabotage.kind == "O2")
		if p.meetings > 0 and now() >= S.emergencyReady and not critical then
			p.meetings -= 1
			callMeeting(p, "Emergency")
		end
		return
	end
	local t = nearestPad(p, pos)
	if t then
		p.openTask = { id = t.id, at = now() }
		local pad = Pads[t.id]
		sendTo(p, "OpenTask", { id = t.id, task = pad:GetAttribute("Task"), room = pad:GetAttribute("Room"),
			hold = R("taskHoldTime"), fake = p.role ~= "Crewmate" })
	end
end

local HANDLERS = {}
HANDLERS.Start = function(p)
	if S.phase ~= "Lobby" then return end
	local gen = setPhase("Countdown", R("startCountdown"))
	after(R("startCountdown"), gen, startGame)
end
HANDLERS.Use = function(p) use(p) end
-- the lobby wardrobe: a free suit colour and a hat from the list
HANDLERS.Wardrobe = function(p, suit, hat)
	if S.phase ~= "Lobby" then return end
	if type(suit) == "string" and table.find(Rules.suits, suit) then
		local taken = false
		for _, q in pairs(S.parts) do if q ~= p and q.suit == suit then taken = true end end
		if not taken then p.suit = suit end
	end
	if type(hat) == "string" and table.find(Hats.LIST, hat) then p.hat = hat end
	if p.model then
		paint(p.model, p.suit); p.model:SetAttribute("Suit", p.suit)
		Hats.wear(p.model, p.hat)
		setGroup(p.model, "TUCrew")
	end
end
HANDLERS.TaskDone = function(p, id)
	local o = p.openTask
	if not o or o.id ~= id or now() - o.at < R("taskHoldTime") * 0.8 then return end
	p.openTask = nil
	markTaskDone(p, id)
end
-- Submit Scan: everyone sees the scanner rings round you (the visual task, proof you are crew)
HANDLERS.Scan = function(p)
	local o = p.openTask
	local pad = o and Pads[o.id]
	if not pad or pad:GetAttribute("Task") ~= "Submit Scan" or p.role ~= "Crewmate" or not p.alive then return end
	local pos = posOf(p)
	if pos then broadcast("Scan", { at = pos, time = 6 }) end
end
HANDLERS.Report = function(p)
	if S.phase ~= "Roam" or not p.alive then return end
	local pos = posOf(p); if not pos then return end
	for _, b in ipairs(Bodies:GetChildren()) do
		local bp = b:GetPivot().Position
		-- first person: you have to be able to see it, a body behind a wall does not count
		if flat(bp, pos) <= R("reportRange") and Rules.lineOfSight(Map, pos, bp) then callMeeting(p, "Body"); return end
	end
end
HANDLERS.Kill = function(p)
	if p.role ~= "Impostor" then return end
	local pos = posOf(p); if not pos then return end
	-- first person: the victim has to be in front of you (the bean faces where its player looks)
	local hrp = hrpOf(p); if not hrp then return end
	local look = hrp.CFrame.LookVector
	local fwd = Vector3.new(look.X, 0, look.Z).Unit
	local cosCone = math.cos(math.rad(R("killCone")))
	local best, bd = nil, R("killRange")
	for _, q in ipairs(list()) do
		if q.alive and q.role ~= "Impostor" then
			local qp = posOf(q)
			local d = qp and flat(qp, pos)
			if d and d <= bd then
				local to = Vector3.new(qp.X - pos.X, 0, qp.Z - pos.Z)
				if d < R("killPointBlank") or (to.Magnitude > 0 and fwd:Dot(to.Unit) >= cosCone) then best, bd = q, d end
			end
		end
	end
	if best then doKill(p, best) end
end
HANDLERS.Vent = function(p) ventUse(p) end
HANDLERS.VentExit = function(p) ventExit(p) end
HANDLERS.Sabotage = function(p, kind, room)
	if p.role ~= "Impostor" then return end
	if kind == "Doors" and type(room) == "string" then closeDoors(room)
	elseif Rules.fixPads[kind] then startSabotage(kind) end
end
HANDLERS.Vote = function(p, target)
	if S.phase ~= "Vote" or not p.alive or S.votes[p.id] then return end
	if target ~= "skip" and not (S.parts[target] and S.parts[target].alive) then return end
	S.votes[p.id] = target
	broadcast("Voted", { id = p.id })
	for _, q in ipairs(list()) do if q.alive and not S.votes[q.id] then return end end
	endVote()
end
HANDLERS.Chat = function(p, text)
	if type(text) ~= "string" then return end
	text = text:sub(1, 120)
	if text:match("^%s*$") then return end
	if not (S.phase == "Lobby" or S.phase == "Discuss" or S.phase == "Vote" or S.phase == "Results") then return end
	local ok, filtered = pcall(function()
		return TextService:FilterStringAsync(text, p.player.UserId):GetNonChatStringForBroadcastAsync()
	end)
	if not ok then
		if not RunService:IsStudio() then return end
		filtered = text
	end
	local msg = { from = p.name, suit = p.suit, text = filtered, ghost = not p.alive }
	if p.alive then broadcast("Chat", msg)
	else
		for _, q in ipairs(list()) do if not q.alive then sendTo(q, "Chat", msg) end end
	end
end

Net.OnServerEvent:Connect(function(player, kind, ...)
	local p = S.parts["p" .. player.UserId]
	local h = HANDLERS[kind]
	if p and h then h(p, ...) end
end)

-- ---------- tick ----------
RunService.Heartbeat:Connect(function()
	local s = S.sabotage
	if s and s.ends > 0 and now() >= s.ends and S.phase == "Roam" then
		endGame("Impostors", s.kind == "Reactor" and "The Reactor melted down" or "The Oxygen ran out")
	end
end)

-- ---------- bots ----------
Bots.init({
	S = S, R = R, now = now, list = list, posOf = posOf, hrpOf = hrpOf, humOf = humOf, flat = flat,
	Pads = Pads, Map = Map, Bodies = Bodies, Rules = Rules, los = function(a, b) return Rules.lineOfSight(Map, a, b) end,
	kill = doKill, report = function(p) callMeeting(p, "Body") end, taskDone = markTaskDone,
	fix = fixAt, sabotage = startSabotage,
})

-- a test hook: ServerStorage-free, set TU attribute AutoStart = true to start as soon as a human joins
setPhase("Lobby")
updateProgress()
clearSabotage()
if TU:GetAttribute("AutoStart") then
	task.delay(2, function() if S.phase == "Lobby" then HANDLERS.Start() end end)
end
print("[TrollUs] server ready")
