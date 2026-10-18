-- Troll Us, phase 1: The Skeld greybox.
-- Run in Studio (execute_luau or the command bar). Rebuilds Workspace.TrollUs from scratch.
-- Layout: our own ring geometry carrying the 14 Skeld rooms. 1 cell = 2 studs; walls are
-- generated on every walkable/non-walkable boundary, so corridors open doors by themselves.

local Workspace = game:GetService("Workspace")
local Lighting = game:GetService("Lighting")

local WALL_H = 9 -- first person: at 6 the void above the walls showed at eye height (3.6)
local CELL = 2
local BOUNDS = { x1 = -100, x2 = 100, z1 = -60, z2 = 60 }

-- {name, x, z, w, d} centre + size, all even so cells line up
local ROOMS = {
	{ name = "Cafeteria",      x = 0,   z = -30, w = 44, d = 36, tint = Color3.fromRGB(214, 214, 220), tasks = { "Fix Wiring", "Empty Garbage" }, vent = { 18, -44 } },
	{ name = "Weapons",        x = 50,  z = -36, w = 24, d = 20, tint = Color3.fromRGB(205, 212, 222), tasks = { "Clear Asteroids", "Download Data" } },
	{ name = "O2",             x = 44,  z = -10, w = 16, d = 16, tint = Color3.fromRGB(206, 220, 212), tasks = { "Clean O2 Filter", "Empty Chute" } },
	{ name = "Navigation",     x = 78,  z = -8,  w = 16, d = 24, tint = Color3.fromRGB(208, 214, 224), tasks = { "Chart Course", "Stabilize Steering", "Download Data" }, vent = { 84, 0 } },
	{ name = "Shields",        x = 52,  z = 24,  w = 20, d = 20, tint = Color3.fromRGB(214, 210, 222), tasks = { "Prime Shields" }, vent = { 58, 30 } },
	{ name = "Communications", x = 28,  z = 38,  w = 20, d = 16, tint = Color3.fromRGB(220, 214, 206), tasks = { "Download Data", "Accept Diverted Power" } },
	{ name = "Storage",        x = 0,   z = 26,  w = 28, d = 32, tint = Color3.fromRGB(200, 200, 204), tasks = { "Fuel Engines", "Empty Garbage" }, door = true },
	{ name = "Admin",          x = 28,  z = 9,   w = 24, d = 18, tint = Color3.fromRGB(222, 218, 206), tasks = { "Swipe Card", "Upload Data", "Fix Wiring" }, vent = { 36, 14 }, door = true },
	{ name = "Electrical",     x = -26, z = 16,  w = 24, d = 20, tint = Color3.fromRGB(222, 212, 200), tasks = { "Fix Wiring", "Divert Power", "Calibrate Distributor", "Download Data" }, vent = { -34, 10 }, door = true },
	{ name = "MedBay",         x = -30, z = -24, w = 20, d = 20, tint = Color3.fromRGB(206, 222, 216), tasks = { "Submit Scan", "Inspect Sample" }, vent = { -36, -18 }, door = true },
	{ name = "Upper Engine",   x = -62, z = -34, w = 24, d = 24, tint = Color3.fromRGB(212, 206, 206), tasks = { "Align Engine Output", "Fuel Engines" }, vent = { -70, -42 }, door = true },
	{ name = "Security",       x = -52, z = -4,  w = 12, d = 16, tint = Color3.fromRGB(206, 206, 216), tasks = { "Fix Wiring", "Accept Diverted Power" }, vent = { -48, 0 }, door = true },
	{ name = "Reactor",        x = -84, z = -4,  w = 20, d = 28, tint = Color3.fromRGB(222, 206, 206), tasks = { "Start Reactor", "Unlock Manifolds" }, vent = { -90, 4 } },
	{ name = "Lower Engine",   x = -62, z = 30,  w = 24, d = 24, tint = Color3.fromRGB(212, 206, 206), tasks = { "Align Engine Output", "Fuel Engines" }, vent = { -70, 38 }, door = true },
}

local HALLS = {
	{ 30, -36, 16, 8 },   -- Cafeteria > Weapons
	{ 50, -20, 8, 16 },   -- Weapons > O2
	{ 61, -10, 18, 8 },   -- O2 > Navigation
	{ 78, 12, 8, 16 },    -- Navigation down (runs to z 20 so the turn into Shields is 8 wide)
	{ 70, 16, 16, 8 },    -- > Shields
	{ 40, 32, 8, 12 },    -- Shields > Communications
	{ 16, 38, 8, 8 },     -- Communications > Storage
	{ 16, 12, 8, 8 },     -- Storage > Admin
	{ 20, -6, 8, 12 },    -- Cafeteria > Admin
	{ 0, -1, 8, 22 },     -- Cafeteria > Storage
	{ -40, -34, 36, 8 },  -- Cafeteria > MedBay > Upper Engine
	{ -62, -2, 8, 48 },   -- Upper Engine > Security > Lower Engine
	{ -75, -20, 14, 8 },  -- Upper Engine > Reactor (at 12 wide it clipped the engine room by 4, too tight for a bean)
	{ -75, 14, 14, 12 },  -- Lower Engine > Reactor (same)
	{ -38, 32, 48, 8 },   -- Lower Engine > Storage (bottom corridor)
	{ -26, 28, 8, 4 },    -- Electrical entry from the bottom corridor
}

-- security cameras: x, z, then the floor point each one looks at, down its own hall
local CAMERAS = {
	{ -62, -30, -62, -6 },  -- Upper Engine, down the hall to Security
	{ -30, 32, -10, 32 },   -- the bottom corridor, toward Storage
	{ 50, -14, 50, -30 },   -- O2, up the hall to Weapons
	{ 78, 10, 72, 18 },     -- Navigation, down the turn to Shields
}
local VENT_GROUPS = {
	Electrical = "A", MedBay = "A", Security = "A",
	Reactor = "B", ["Upper Engine"] = "B", ["Lower Engine"] = "B",
	Admin = "C", Cafeteria = "C",
	Navigation = "D", Shields = "D",
}

-- ---------- helpers ----------
local function rect(r) -- {x,z,w,d} or room -> x1,x2,z1,z2
	local x, z, w, d = r.x or r[1], r.z or r[2], r.w or r[3], r.d or r[4]
	return x - w / 2, x + w / 2, z - d / 2, z + d / 2
end

local function part(props)
	local p = Instance.new("Part")
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Material = Enum.Material.SmoothPlastic
	for k, v in pairs(props) do p[k] = v end
	return p
end

-- ---------- reset ----------
local old = Workspace:FindFirstChild("TrollUs")
if old then old:Destroy() end
local base = Workspace:FindFirstChild("Baseplate")
if base then base:Destroy() end

local root = Instance.new("Folder"); root.Name = "TrollUs"
local map = Instance.new("Model"); map.Name = "Map"; map.Parent = root
local F = {}
for _, n in ipairs({ "Rooms", "Halls", "Walls", "Vents", "Doors", "Tasks", "Cameras", "Props", "FixPads", "Ceiling" }) do
	local f = Instance.new("Folder"); f.Name = n; f.Parent = map; F[n] = f
end

-- space under the ship
part({ Name = "Space", Size = Vector3.new(420, 1, 300), Position = Vector3.new(0, -2, 0),
	Color = Color3.fromRGB(10, 10, 16), Parent = F.Props })

-- ---------- floors ----------
for _, r in ipairs(ROOMS) do
	local p = part({ Name = r.name, Size = Vector3.new(r.w, 1, r.d), Position = Vector3.new(r.x, -0.5, r.z),
		Color = r.tint, Parent = F.Rooms })
	p:SetAttribute("Room", r.name)
	-- floating room label for the greybox
	local tag = part({ Name = "Label", Size = Vector3.new(1, 1, 1), Position = Vector3.new(r.x, 0.6, r.z),
		Transparency = 1, CanCollide = false, CanQuery = false, Parent = p })
	local bb = Instance.new("BillboardGui"); bb.Size = UDim2.new(0, 160, 0, 28); bb.AlwaysOnTop = true
	bb.StudsOffset = Vector3.new(0, 0, 0); bb.Parent = tag
	local tl = Instance.new("TextLabel"); tl.Size = UDim2.new(1, 0, 1, 0); tl.BackgroundTransparency = 1
	tl.Text = r.name; tl.TextColor3 = Color3.fromRGB(40, 40, 48); tl.TextStrokeTransparency = 0.6
	tl.TextStrokeColor3 = Color3.new(1, 1, 1); tl.Font = Enum.Font.GothamBold; tl.TextSize = 16; tl.Parent = bb
end
for i, h in ipairs(HALLS) do
	part({ Name = "Hall" .. i, Size = Vector3.new(h[3], 1, h[4]), Position = Vector3.new(h[1], -0.5, h[2]),
		Color = Color3.fromRGB(172, 174, 182), Parent = F.Halls })
end
task.wait()

-- ---------- walls from the walkable grid ----------
local rects = {}
for _, r in ipairs(ROOMS) do table.insert(rects, { rect(r) }) end
for _, h in ipairs(HALLS) do table.insert(rects, { rect(h) }) end

local function walkable(cx, cz)
	for _, q in ipairs(rects) do
		if cx >= q[1] and cx < q[2] and cz >= q[3] and cz < q[4] then return true end
	end
	return false
end

local nx = (BOUNDS.x2 - BOUNDS.x1) / CELL
local nz = (BOUNDS.z2 - BOUNDS.z1) / CELL
local grid = {}
for i = 0, nx - 1 do
	grid[i] = {}
	for j = 0, nz - 1 do
		grid[i][j] = walkable(BOUNDS.x1 + i * CELL + CELL / 2, BOUNDS.z1 + j * CELL + CELL / 2)
	end
end
local function W(i, j)
	if i < 0 or j < 0 or i >= nx or j >= nz then return false end
	return grid[i][j]
end

-- horizontal runs (walls along x) keyed by z-edge; vertical runs keyed by x-edge
local hruns, vruns = {}, {}
for i = 0, nx - 1 do
	for j = 0, nz - 1 do
		if grid[i][j] then
			if not W(i, j - 1) then hruns[j] = hruns[j] or {}; hruns[j][i] = true end       -- north edge
			if not W(i, j + 1) then hruns[j + 1] = hruns[j + 1] or {}; hruns[j + 1][i] = true end
			if not W(i - 1, j) then vruns[i] = vruns[i] or {}; vruns[i][j] = true end       -- west edge
			if not W(i + 1, j) then vruns[i + 1] = vruns[i + 1] or {}; vruns[i + 1][j] = true end
		end
	end
end

local WALL_COLOR = Color3.fromRGB(96, 98, 110)
local count = 0
local function flushRun(alongX, line, a, b)
	-- cells a..b inclusive along the run
	local len = (b - a + 1) * CELL
	local p
	if alongX then
		local x = BOUNDS.x1 + a * CELL + len / 2
		local z = BOUNDS.z1 + line * CELL
		p = part({ Size = Vector3.new(len + 1, WALL_H, 1), Position = Vector3.new(x, WALL_H / 2, z) })
	else
		local z = BOUNDS.z1 + a * CELL + len / 2
		local x = BOUNDS.x1 + line * CELL
		p = part({ Size = Vector3.new(1, WALL_H, len + 1), Position = Vector3.new(x, WALL_H / 2, z) })
	end
	p.Name = "Wall"; p.Color = WALL_COLOR; p.Parent = F.Walls
	count += 1
	if count % 40 == 0 then task.wait() end
end
local function emit(runs, alongX)
	for line, cells in pairs(runs) do
		local idx = {}
		for c in pairs(cells) do table.insert(idx, c) end
		table.sort(idx)
		local a, prev = nil, nil
		for _, c in ipairs(idx) do
			if a == nil then a, prev = c, c
			elseif c == prev + 1 then prev = c
			else flushRun(alongX, line, a, prev); a, prev = c, c end
		end
		if a ~= nil then flushRun(alongX, line, a, prev) end
	end
end
emit(hruns, true)
emit(vruns, false)
task.wait()

-- ---------- doors: where a hall crosses a door room's edge ----------
local DOOR_COLOR = Color3.fromRGB(255, 196, 64)
for _, r in ipairs(ROOMS) do
	if r.door then
		local x1, x2, z1, z2 = rect(r)
		for _, h in ipairs(HALLS) do
			local hx1, hx2, hz1, hz2 = rect(h)
			local ox1, ox2 = math.max(x1, hx1), math.min(x2, hx2)
			local oz1, oz2 = math.max(z1, hz1), math.min(z2, hz2)
			local function door(cx, cz, w, d)
				local p = part({ Name = "Door", Size = Vector3.new(w, WALL_H - 0.5, d), Position = Vector3.new(cx, (WALL_H - 0.5) / 2, cz),
					Color = DOOR_COLOR, Transparency = 0.75, CanCollide = false, Parent = F.Doors })
				p:SetAttribute("Room", r.name)
			end
			if ox2 > ox1 and hz1 < z1 and hz2 > z1 then door((ox1 + ox2) / 2, z1, ox2 - ox1, 0.6) end -- north edge
			if ox2 > ox1 and hz1 < z2 and hz2 > z2 then door((ox1 + ox2) / 2, z2, ox2 - ox1, 0.6) end -- south edge
			if oz2 > oz1 and hx1 < x1 and hx2 > x1 then door(x1, (oz1 + oz2) / 2, 0.6, oz2 - oz1) end -- west edge
			if oz2 > oz1 and hx1 < x2 and hx2 > x2 then door(x2, (oz1 + oz2) / 2, 0.6, oz2 - oz1) end -- east edge
			-- a hall that ends flush against the edge (adjacent cells, no overlap)
			if ox2 > ox1 and hz2 == z1 then door((ox1 + ox2) / 2, z1, ox2 - ox1, 0.6) end
			if ox2 > ox1 and hz1 == z2 then door((ox1 + ox2) / 2, z2, ox2 - ox1, 0.6) end
			if oz2 > oz1 and hx2 == x1 then door(x1, (oz1 + oz2) / 2, 0.6, oz2 - oz1) end
			if oz2 > oz1 and hx1 == x2 then door(x2, (oz1 + oz2) / 2, 0.6, oz2 - oz1) end
		end
	end
end

-- ---------- vents, tasks, cameras, button, spawn ----------
local taskId = 0
for _, r in ipairs(ROOMS) do
	if r.vent then
		local v = part({ Name = "Vent", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.4, 3.2, 3.2),
			CFrame = CFrame.new(r.vent[1], 0.2, r.vent[2]) * CFrame.Angles(0, 0, math.rad(90)),
			Color = Color3.fromRGB(58, 60, 70), Parent = F.Vents })
		v:SetAttribute("Room", r.name)
		v:SetAttribute("Group", VENT_GROUPS[r.name] or "?")
	end
	local x1, x2, z1, z2 = rect(r)
	for i, t in ipairs(r.tasks) do
		taskId += 1
		local px = x1 + 3 + (i - 1) * 4.5
		local pad = part({ Name = "Task", Size = Vector3.new(2.4, 0.3, 2.4), Position = Vector3.new(px, 0.15, z1 + 2.5),
			Color = Color3.fromRGB(80, 200, 120), Parent = F.Tasks })
		pad:SetAttribute("Room", r.name)
		pad:SetAttribute("Task", t)
		pad:SetAttribute("TaskId", taskId)
	end
end
for i, c in ipairs(CAMERAS) do
	-- head height over corridor junctions: must not collide, or Crewmate domes snag on them
	local cam = part({ Name = "Camera" .. i, Size = Vector3.new(1.2, 1.2, 1.6), Position = Vector3.new(c[1], WALL_H - 1, c[2]),
		Color = Color3.fromRGB(230, 60, 60), CanCollide = false, CanQuery = false, Parent = F.Cameras })
	cam:SetAttribute("Index", i)
	cam:SetAttribute("LookAt", Vector3.new(c[3], 0, c[4]))
end
-- sabotage fix pads: Rules.fixPads says how many each Kind needs (Reactor and O2 need both)
local FIX_PADS = {
	{ "LightsFix1", "Lights", 1, "Electrical", -36, 22, Color3.fromRGB(255, 220, 60) },
	{ "ReactorFix1", "Reactor", 1, "Reactor", -90, -12, Color3.fromRGB(255, 80, 60) },
	{ "ReactorFix2", "Reactor", 2, "Reactor", -78, 6, Color3.fromRGB(255, 80, 60) },
	{ "CommsFix1", "Comms", 1, "Communications", 34, 44, Color3.fromRGB(200, 120, 255) },
	{ "O2Fix1", "O2", 1, "O2", 50, -4, Color3.fromRGB(80, 200, 255) },
	{ "O2Fix2", "O2", 2, "Admin", 36, 4, Color3.fromRGB(80, 200, 255) },
}
for _, f in ipairs(FIX_PADS) do
	local p = part({ Name = f[1], Size = Vector3.new(2.6, 0.3, 2.6), Position = Vector3.new(f[5], 0.15, f[6]),
		Color = f[7], Material = Enum.Material.Neon, CanCollide = false, Parent = F.FixPads })
	p:SetAttribute("Kind", f[2]); p:SetAttribute("Index", f[3]); p:SetAttribute("Room", f[4]); p:SetAttribute("Fixed", false)
end
-- emergency table + button
part({ Name = "CafeteriaTable", Size = Vector3.new(9, 2.4, 9), Position = Vector3.new(0, 1.2, -30),
	Color = Color3.fromRGB(150, 152, 160), Parent = F.Props })
local btn = part({ Name = "EmergencyButton", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.6, 3, 3),
	CFrame = CFrame.new(0, 2.7, -30) * CFrame.Angles(0, 0, math.rad(90)), Color = Color3.fromRGB(230, 40, 40), Parent = F.Props })
btn:SetAttribute("Room", "Cafeteria")

-- Security desk: Use here to watch the four cameras (client-side view, see TrollUsHUD)
local desk = part({ Name = "SecurityDesk", Size = Vector3.new(6, 2.5, 1.4), Position = Vector3.new(-54, 1.25, 3),
	Color = Color3.fromRGB(70, 74, 86), Parent = F.Props })
desk:SetAttribute("Room", "Security")
for i = -1, 1 do
	part({ Name = "Monitor", Size = Vector3.new(1.7, 1.2, 0.2), CFrame = CFrame.new(-54 + i * 1.9, 3.15, 3.2) * CFrame.Angles(math.rad(-10), 0, 0),
		Color = Color3.fromRGB(60, 120, 200), Material = Enum.Material.Neon, CanCollide = false, Parent = F.Props })
end

-- ceilings: one dark slab per room and hall plus a light panel per room. CastShadow off so the sun still
-- lights the floors (the ship has no interior lights yet)
local CEIL = Color3.fromRGB(44, 46, 56)
local function ceiling(x, z, w, d)
	part({ Name = "Ceiling", Size = Vector3.new(w + 1, 1, d + 1), Position = Vector3.new(x, WALL_H + 0.5, z),
		Color = CEIL, CastShadow = false, Parent = F.Ceiling })
end
for _, r in ipairs(ROOMS) do
	ceiling(r.x, r.z, r.w, r.d)
	part({ Name = "LightPanel", Size = Vector3.new(math.max(4, r.w * 0.45), 0.1, 1.6), Position = Vector3.new(r.x, WALL_H - 0.05, r.z),
		Color = Color3.fromRGB(235, 240, 255), Material = Enum.Material.Neon, CanCollide = false, CanQuery = false, CastShadow = false, Parent = F.Ceiling })
end
for _, h in ipairs(HALLS) do ceiling(h[1], h[2], h[3], h[4]) end

local spawn = Instance.new("SpawnLocation")
spawn.Name = "Spawn"; spawn.Size = Vector3.new(10, 1, 10); spawn.Position = Vector3.new(0, -0.45, -18)
spawn.Anchored = true; spawn.Transparency = 1; spawn.CanCollide = false; spawn.Neutral = true; spawn.Duration = 0
spawn.Parent = F.Props

root.Parent = Workspace

-- ---------- lighting ----------
Lighting.ClockTime = 14
Lighting.Brightness = 2
Lighting.GlobalShadows = true
Lighting.Ambient = Color3.fromRGB(110, 110, 120)
Lighting.OutdoorAmbient = Color3.fromRGB(120, 120, 130)
-- vision is classic fog: an Atmosphere turns it off, and depth of field blurs the first-person view
for _, c in ipairs(Lighting:GetChildren()) do
	if c:IsA("Atmosphere") then c:Destroy() elseif c:IsA("DepthOfFieldEffect") then c.Enabled = false end
end

print(("TrollUs built: %d rooms, %d halls, %d walls, %d doors, %d vents, %d tasks")
	:format(#ROOMS, #HALLS, #F.Walls:GetChildren(), #F.Doors:GetChildren(), #F.Vents:GetChildren(), #F.Tasks:GetChildren()))
