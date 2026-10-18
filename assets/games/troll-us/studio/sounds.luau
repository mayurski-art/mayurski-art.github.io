-- Sounds (ModuleScript in ReplicatedStorage.TrollUs): plays the synthesised set from assets/games/troll-us/sounds
-- (made by tools/synth-sounds.mjs). Rules.sounds maps a name to its uploaded rbxassetid; a name with no id falls
-- back to rbxasset://sounds/trollus/<name>.wav, which only exists on a machine where the WAVs were copied into
-- Studio's content folder (the local test bench). Positional sounds sit in a Part, so Roblox pans and fades them:
-- in first person you hear who is behind you.
local RS = game:GetService("ReplicatedStorage")
local Debris = game:GetService("Debris")
local SoundService = game:GetService("SoundService")
local TU = RS:WaitForChild("TrollUs")
local Rules = require(TU:WaitForChild("Rules"))

local Sounds = {}

-- how loud each one is and how far it carries (studs until it is silent)
local MIX = {
	step1 = { vol = 0.45, far = 40 }, step2 = { vol = 0.45, far = 40 },
	kill = { vol = 1.0, far = 60 }, vent = { vol = 0.8, far = 45 }, door = { vol = 0.8, far = 55 },
	siren = { vol = 0.7 }, report = { vol = 0.8 }, vote = { vol = 0.7 }, eject = { vol = 0.8 },
	win = { vol = 0.7 }, defeat = { vol = 0.7 }, task = { vol = 0.6 }, alarm = { vol = 0.45 },
	reveal = { vol = 0.8 }, click = { vol = 0.35 },
}

function Sounds.id(name)
	local ids = Rules.sounds or {}
	local id = ids[name]
	if id and id ~= "" then return id end
	return "rbxasset://sounds/trollus/" .. name .. ".wav"
end

local function make(name, opts, parent)
	opts = opts or {}
	local mix = MIX[name] or {}
	local s = Instance.new("Sound")
	s.Name = name
	s.SoundId = Sounds.id(name)
	s.Volume = (mix.vol or 0.7) * (opts.volume or 1)
	s.PlaybackSpeed = opts.speed or 1
	s.Looped = opts.loop or false
	if mix.far then
		s.RollOffMode = Enum.RollOffMode.InverseTapered
		s.RollOffMinDistance = opts.near or 6
		s.RollOffMaxDistance = opts.far or mix.far
	end
	s.Parent = parent
	return s
end

-- the folder for one-shot emitters at a point in the world (this client only)
local function emitters()
	local f = workspace:FindFirstChild("TrollUsSounds")
	if not f then f = Instance.new("Folder"); f.Name = "TrollUsSounds"; f.Parent = workspace end
	return f
end

-- heard the same everywhere: meetings, votes, stings, the UI
function Sounds.play(name, opts)
	local s = make(name, opts, SoundService)
	s:Play()
	if not s.Looped then Debris:AddItem(s, 6) end
	return s
end

-- heard from a point: fades with distance and pans left/right
function Sounds.at(name, pos, opts)
	local p = Instance.new("Part")
	p.Name = "Emitter"; p.Anchored = true; p.CanCollide = false; p.CanQuery = false; p.CanTouch = false
	p.Transparency = 1; p.Size = Vector3.new(0.2, 0.2, 0.2); p.CFrame = CFrame.new(pos)
	p.Parent = emitters()
	local s = make(name, opts, p)
	s:Play()
	Debris:AddItem(p, 6)
	return s
end

-- heard from a moving part (a bean's root): follows it
function Sounds.on(part, name, opts)
	local s = make(name, opts, part)
	s:Play()
	if not s.Looped then Debris:AddItem(s, 3) end
	return s
end

-- one of ours (and not a stock Roblox character sound)?
function Sounds.ours(s) return MIX[s.Name] ~= nil end

return Sounds
