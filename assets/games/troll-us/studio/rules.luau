-- Troll Us rules: the single source of truth for both builds (ReplicatedStorage.TrollUs.Rules).
-- Any key can be overridden for a test by setting an attribute of the same name on
-- ReplicatedStorage.TrollUs (the server and client read overrides through R(key)).
local Rules = {
	minPlayers = 4,
	maxPlayers = 10,
	botFillTo = 8,

	killCooldown = 25,      -- s, host-set 10..60 later
	killRange = 6,          -- studs
	reportRange = 8,
	useRange = 5,
	ventRange = 5,

	discussionTime = 30,
	votingTime = 60,
	startCountdown = 5,
	roleRevealTime = 4,
	ejectionTime = 7,
	gameOverTime = 8,

	tasksPerPlayer = 4,
	taskHoldTime = 1,       -- s at least between opening a task panel and finishing it (the server checks)
	emergencyMeetings = 1,
	emergencyCooldown = 15,

	walkSpeed = 14,
	sabotageCooldown = 30,
	sabotageTimer = 45,     -- Reactor / O2 countdown (30 was too short for bots crossing the ship)
	doorsCloseTime = 10,
	doorsCooldown = 30,

	confirmEjects = true,
	botThinkInterval = 0.5,
	botTaskTime = 6,        -- seconds a bot stands at a task; at 3 the bot crew won on tasks in ~90 s
	botWalkSpeed = 12,
}

function Rules.impostorsFor(n)
	return n >= 7 and 2 or 1
end

-- first person: a kill needs the victim inside this cone in front of the killer (half-angle, degrees),
-- unless they are closer than killPointBlank
Rules.killCone = 35
Rules.killPointBlank = 2.5

-- can someone whose feet are at `from` see the point `to`? Only walls and shut doors block the view.
-- Shared by the server (reports), the bots and the HUD (the REPORT button) so all three agree.
function Rules.lineOfSight(map, from, to)
	local block = { map.Walls }
	for _, d in ipairs(map.Doors:GetChildren()) do if d.CanCollide then table.insert(block, d) end end
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Include
	params.FilterDescendantsInstances = block
	local eye = Vector3.new(from.X, 3.6, from.Z)
	local target = Vector3.new(to.X, 1, to.Z)
	return workspace:Raycast(eye, target - eye, params) == nil
end

-- fix pads per sabotage: Kind -> list of {room, x, z}; build-skeld.luau builds the parts (keep the two in sync)
Rules.fixPads = {
	Lights = { { room = "Electrical", x = -36, z = 22 } },
	Reactor = { { room = "Reactor", x = -90, z = -12 }, { room = "Reactor", x = -78, z = 6 } },
	O2 = { { room = "O2", x = 50, z = -4 }, { room = "Admin", x = 36, z = 4 } },
	Comms = { { room = "Communications", x = 34, z = 44 } },
}

-- uploaded audio: name -> "rbxassetid://..." once the WAVs in assets/games/troll-us/sounds are on Roblox.
-- An empty entry plays rbxasset://sounds/trollus/<name>.wav (the WAVs copied into Studio for local tests).
-- Names: step1 step2 kill vent door siren report vote eject win defeat task alarm reveal click
Rules.sounds = {}

Rules.suits = { "Red", "Blue", "Green", "Pink", "Orange", "Yellow", "Black", "White", "Purple", "Brown", "Cyan", "Lime" }
Rules.botNames = { "Alex", "Sam", "Jordan", "Casey", "Riley", "Morgan", "Taylor", "Jamie", "Avery", "Quinn" }

return Rules
