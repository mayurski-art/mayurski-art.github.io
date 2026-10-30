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

-- audio: name -> asset id. These are free sounds from Roblox's own licensed libraries in the Creator Store
-- (Pro Sound Effects and APM Music), so they play in any experience without uploading anything.
-- A name with no id plays rbxasset://sounds/trollus/<name>.wav: our synthesised WAVs in
-- assets/games/troll-us/sounds, which only exist where they were copied into Studio's content folder.
Rules.sounds = {
	step1 = "rbxassetid://9118246309",   -- Robot Footsteps Metal Sparks 1 (SFX), 0.3 s; pitch varies per step
	step2 = "rbxassetid://9118246309",
	kill = "rbxassetid://9113480915",    -- Body Fall Thud 2 (SFX)
	vent = "rbxassetid://9116644054",    -- Metal Hatch Squeak Open Quickly Close 2 (SFX)
	door = "rbxassetid://9120370628",    -- Vehicle Door Bump Slamming Metal Door 1 (SFX)
	siren = "rbxassetid://9119662934",   -- Submarine Alarm Klaxon 6 (SFX), the emergency meeting
	report = "rbxassetid://9040287613",  -- Sudden Strike (APM), orchestra and choir stab: a body is found
	vote = "rbxassetid://9113649171",    -- Button Click And Ring 1 (SFX)
	eject = "rbxassetid://9125805781",   -- Rising Whoosh Hissing Build Up (SFX)
	win = "rbxassetid://9042409054",     -- Day Of The Election Sting 2 (APM), fanfare
	defeat = "rbxassetid://1846942404",  -- Loser Sting Three B (APM)
	task = "rbxassetid://9119802022",    -- Synth Chime Single Synth Tone 2 (SFX)
	alarm = "rbxassetid://9119160581",   -- Siren Blat 4 (SFX), looped for Reactor / O2
	reveal = "rbxassetid://125909120236588", -- Mounting Consequences StingA (APM)
	click = "rbxassetid://9119717523",   -- Switch Click On Or Off Toggle Button 2 (SFX)
}

Rules.suits = { "Red", "Blue", "Green", "Pink", "Orange", "Yellow", "Black", "White", "Purple", "Brown", "Cyan", "Lime" }
-- every bot is just "bot" (user, 2026-10-30)
Rules.botNames = { "bot" }

return Rules
