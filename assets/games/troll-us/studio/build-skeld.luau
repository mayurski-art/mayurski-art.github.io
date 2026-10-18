-- Troll Us: The Skeld. Phase 1 greybox; phase 3e rooms (floors, doors, vent lids, consoles, windows, props, lights).
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
	{ name = "Electrical",     x = -28, z = 16,  w = 24, d = 20, tint = Color3.fromRGB(222, 212, 200), tasks = { "Fix Wiring", "Divert Power", "Calibrate Distributor", "Download Data" }, vent = { -38, 14 }, door = true },
	{ name = "MedBay",         x = -34, z = -24, w = 20, d = 20, tint = Color3.fromRGB(206, 222, 216), tasks = { "Submit Scan", "Inspect Sample" }, vent = { -40, -18 }, door = true },
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
-- each room's light tint
local LIGHTS = {
	Cafeteria = Color3.fromRGB(255, 246, 228), Weapons = Color3.fromRGB(210, 225, 255), O2 = Color3.fromRGB(200, 255, 215),
	Navigation = Color3.fromRGB(190, 215, 255), Shields = Color3.fromRGB(205, 200, 255), Communications = Color3.fromRGB(255, 225, 190),
	Storage = Color3.fromRGB(255, 240, 215), Admin = Color3.fromRGB(255, 236, 200), Electrical = Color3.fromRGB(255, 220, 150),
	MedBay = Color3.fromRGB(195, 255, 240), ["Upper Engine"] = Color3.fromRGB(255, 205, 170), Security = Color3.fromRGB(190, 205, 255),
	Reactor = Color3.fromRGB(255, 190, 180), ["Lower Engine"] = Color3.fromRGB(255, 205, 170),
}
for _, r in ipairs(ROOMS) do r.light = LIGHTS[r.name] end
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
for _, n in ipairs({ "Rooms", "Halls", "Walls", "Vents", "Doors", "Tasks", "Cameras", "Props", "FixPads", "Ceiling", "Decor" }) do
	local f = Instance.new("Folder"); f.Name = n; f.Parent = map; F[n] = f
end

-- space under the ship
part({ Name = "Space", Size = Vector3.new(420, 1, 300), Position = Vector3.new(0, -2, 0),
	Color = Color3.fromRGB(10, 10, 16), Parent = F.Props })

-- ---------- floors ----------
-- two-tone tiles: the room part is the darker tone, every other 4-stud tile sits on it in the room tint
local function shade(c, k) return Color3.new(math.min(c.R * k, 1), math.min(c.G * k, 1), math.min(c.B * k, 1)) end
local TILE = 4
for _, r in ipairs(ROOMS) do
	local p = part({ Name = r.name, Size = Vector3.new(r.w, 1, r.d), Position = Vector3.new(r.x, -0.5, r.z),
		Color = shade(r.tint, 0.8), Parent = F.Rooms })
	p:SetAttribute("Room", r.name)
	local x1, z1 = r.x - r.w / 2, r.z - r.d / 2
	local tiles = Instance.new("Model"); tiles.Name = "Tiles"
	for i = 0, math.ceil(r.w / TILE) - 1 do
		for j = 0, math.ceil(r.d / TILE) - 1 do
			if (i + j) % 2 == 0 then
				local tw, td = math.min(TILE, r.w - i * TILE), math.min(TILE, r.d - j * TILE)
				part({ Name = "Tile", Size = Vector3.new(tw, 0.04, td), Position = Vector3.new(x1 + i * TILE + tw / 2, 0.02, z1 + j * TILE + td / 2),
					Color = r.tint, CanCollide = false, CanQuery = false, CanTouch = false, CastShadow = false, Parent = tiles })
			end
		end
	end
	tiles.Parent = F.Decor
end
for i, h in ipairs(HALLS) do
	part({ Name = "Hall" .. i, Size = Vector3.new(h[3], 1, h[4]), Position = Vector3.new(h[1], -0.5, h[2]),
		Color = Color3.fromRGB(150, 153, 163), Material = Enum.Material.DiamondPlate, Parent = F.Halls })
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

local WALL_COLOR = Color3.fromRGB(168, 172, 186)
local BAND_COLOR = Color3.fromRGB(84, 88, 102)
local TRIM_COLOR = Color3.fromRGB(112, 116, 130)
local trim = Instance.new("Model"); trim.Name = "Trim"; trim.Parent = F.Decor
-- a dark band along the bottom of every wall and a trim strip under the ceiling, a hair proud of both faces
local function bands(size, pos)
	local thick = Vector3.new(size.X > size.Z and 0 or 0.16, 0, size.Z > size.X and 0 or 0.16)
	part({ Name = "Band", Size = Vector3.new(size.X, 2.4, size.Z) + thick, Position = Vector3.new(pos.X, 1.2, pos.Z), Color = BAND_COLOR,
		CanCollide = false, CanQuery = false, CanTouch = false, Parent = trim })
	part({ Name = "Trim", Size = Vector3.new(size.X, 0.6, size.Z) + thick, Position = Vector3.new(pos.X, WALL_H - 0.6, pos.Z), Color = TRIM_COLOR,
		CanCollide = false, CanQuery = false, CanTouch = false, Parent = trim })
end
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
	bands(p.Size, p.Position)
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

-- ---------- windows onto space ----------
-- each cuts a hole in an outer wall run: sill, header and glass replace that stretch, and a black backdrop
-- a few studs outside carries the stars, close enough to beat the vision fog, with depth for parallax
local WINDOWS = {
	{ room = "Cafeteria",  alongX = true,  line = -48, a = 2,   b = 14, out = -1 },
	{ room = "Weapons",    alongX = true,  line = -46, a = 50,  b = 60, out = -1 },
	{ room = "Weapons",    alongX = false, line = 62,  a = -43, b = -29, out = 1, planet = Color3.fromRGB(214, 120, 70) },
	{ room = "Navigation", alongX = false, line = 86,  a = -17, b = 1,  out = 1, planet = Color3.fromRGB(90, 150, 220) },
	{ room = "Storage",    alongX = true,  line = 42,  a = -6,  b = 6,  out = 1 },
}
local SILL, HEAD = 2.6, 7.2
local stars = Random.new(42)
for _, w in ipairs(WINDOWS) do
	-- world position from (along, y, out): along runs with the wall, out is the distance outside it
	local function at(u, y, o)
		if w.alongX then return Vector3.new(u, y, w.line + o * w.out) end
		return Vector3.new(w.line + o * w.out, y, u)
	end
	local function sized(len, h, thick)
		if w.alongX then return Vector3.new(len, h, thick) end
		return Vector3.new(thick, h, len)
	end
	for _, p in ipairs(F.Walls:GetChildren()) do
		local isX = p.Size.X > p.Size.Z
		local lineOk = isX == w.alongX and math.abs((isX and p.Position.Z or p.Position.X) - w.line) < 0.01
		local c = isX and p.Position.X or p.Position.Z
		local half = (isX and p.Size.X or p.Size.Z) / 2
		if lineOk and c - half <= w.a and c + half >= w.b then
			local lo, hi = c - half, c + half
			p:Destroy()
			local function wallBit(u1, u2, y1, y2)
				if u2 - u1 < 0.05 then return end
				part({ Name = "Wall", Size = sized(u2 - u1, y2 - y1, 1), Position = at((u1 + u2) / 2, (y1 + y2) / 2, 0), Color = WALL_COLOR, Parent = F.Walls })
			end
			wallBit(lo, w.a, 0, WALL_H); wallBit(w.b, hi, 0, WALL_H)
			wallBit(w.a, w.b, 0, SILL); wallBit(w.a, w.b, HEAD, WALL_H)
			part({ Name = "Glass", Size = sized(w.b - w.a, HEAD - SILL, 0.2), Position = at((w.a + w.b) / 2, (SILL + HEAD) / 2, 0),
				Color = Color3.fromRGB(170, 200, 240), Material = Enum.Material.Glass, Transparency = 0.82, CastShadow = false, Parent = F.Walls })
			break
		end
	end
	local win = Instance.new("Model"); win.Name = "Window"; win:SetAttribute("Room", w.room)
	local frame = Color3.fromRGB(70, 74, 88)
	local mid = (w.a + w.b) / 2
	local function deco(size, pos, color, mat)
		return part({ Size = size, Position = pos, Color = color, Material = mat or Enum.Material.SmoothPlastic,
			CanCollide = false, CanQuery = false, CanTouch = false, Parent = win })
	end
	-- frame: sill ledge, header, the two sides and mullions every 4 studs, proud of the inside face
	deco(sized(w.b - w.a + 0.8, 0.35, 1.5), at(mid, SILL, 0), frame)
	deco(sized(w.b - w.a + 0.8, 0.35, 1.3), at(mid, HEAD, 0), frame)
	for u = w.a, w.b + 0.01, 4 do deco(sized(0.35, HEAD - SILL, 1.3), at(math.min(u, w.b), (SILL + HEAD) / 2, 0), frame) end
	deco(sized(w.b - w.a, 0.2, 0.2), at(mid, SILL + 0.05, -0.65), Color3.fromRGB(255, 200, 70), Enum.Material.Neon) -- a thin running light on the sill
	-- space: backdrop, stars at random depths, and a planet in some windows
	local D = 7
	deco(sized(w.b - w.a + 22, 26, 1), at(mid, 3, D), Color3.fromRGB(4, 4, 10))
	for _ = 1, math.floor((w.b - w.a) * 5) do
		local o = stars:NextNumber(1.2, D - 0.6)
		local spread = (w.b - w.a) / 2 + o * 1.4
		local s = stars:NextNumber(0.06, 0.2)
		local tint = stars:NextNumber() < 0.15 and Color3.fromRGB(255, 220, 170) or Color3.fromRGB(235, 240, 255)
		local st = deco(Vector3.new(s, s, s), at(mid + stars:NextNumber(-spread, spread), stars:NextNumber(-3, 12), o), tint, Enum.Material.Neon)
		st.Shape = Enum.PartType.Ball; st.CastShadow = false
	end
	if w.planet then
		local pl = deco(Vector3.new(5, 5, 5), at(mid - (w.b - w.a) * 0.22, 8.5, D - 3), w.planet)
		pl.Shape = Enum.PartType.Ball
		local ring = deco(Vector3.new(0.1, 8.4, 8.4), at(mid - (w.b - w.a) * 0.22, 8.5, D - 3), shade(w.planet, 0.75))
		ring.Shape = Enum.PartType.Cylinder
		ring.CFrame = CFrame.new(ring.Position) * CFrame.Angles(0, w.alongX and math.rad(90) or 0, math.rad(70))
		ring.Transparency = 0.35
	end
	win.Parent = F.Decor
end
task.wait()

-- ---------- doors: where a hall crosses a door room's edge ----------
-- the Door part is the invisible collider the server switches. Its two panel halves wait above the ceiling
-- and drop to shut it (OpenCF/ShutCF attributes, tweened by the server), and the Lamp turns red. They drop
-- rather than slide because some doorways sit only 2 studs apart, with no wall to slide into.
local DOOR_H = 7.4
local PANEL = Color3.fromRGB(150, 156, 170)
for _, r in ipairs(ROOMS) do
	if r.door then
		local x1, x2, z1, z2 = rect(r)
		for _, h in ipairs(HALLS) do
			local hx1, hx2, hz1, hz2 = rect(h)
			local ox1, ox2 = math.max(x1, hx1), math.min(x2, hx2)
			local oz1, oz2 = math.max(z1, hz1), math.min(z2, hz2)
			local function door(cx, cz, w, d)
				local p = part({ Name = "Door", Size = Vector3.new(w, WALL_H - 0.5, d), Position = Vector3.new(cx, (WALL_H - 0.5) / 2, cz),
					Color = PANEL, Transparency = 1, CanCollide = false, Parent = F.Doors })
				p:SetAttribute("Room", r.name)
				local alongX = w > d
				local span = alongX and w or d
				local axis = alongX and Vector3.xAxis or Vector3.zAxis
				local function sized(len, hh, thick) return alongX and Vector3.new(len, hh, thick) or Vector3.new(thick, hh, len) end
				local function slider(name, size, y, color, mat, side)
					local base = Vector3.new(cx, y, cz)
					local shut = CFrame.new(base + axis * (side * span / 4))
					local open = shut + Vector3.new(0, DOOR_H + 1.9, 0)
					local s = part({ Name = name, Size = size, CFrame = open, Color = color, Material = mat,
						CanCollide = false, CanQuery = false, CanTouch = false, Parent = p })
					s:SetAttribute("OpenCF", open); s:SetAttribute("ShutCF", shut)
				end
				for side = -1, 1, 2 do
					slider("Panel", sized(span / 2, DOOR_H, 0.5), DOOR_H / 2, PANEL, Enum.Material.Metal, side)
					slider("Stripe", sized(span / 2, 0.8, 0.56), 2.4, Color3.fromRGB(240, 190, 40), Enum.Material.SmoothPlastic, side)
					slider("Edge", sized(0.3, DOOR_H, 0.6), DOOR_H / 2, Color3.fromRGB(60, 64, 76), Enum.Material.SmoothPlastic, side)
				end
				-- the Edge strips sit at the panels' centres; move them to the meeting edge
				for _, e in ipairs(p:GetChildren()) do
					if e.Name == "Edge" then
						local o, sh = e:GetAttribute("OpenCF"), e:GetAttribute("ShutCF")
						local toward = (Vector3.new(cx, 0, cz) - Vector3.new(sh.X, 0, sh.Z)).Unit * (span / 4 - 0.15)
						e:SetAttribute("OpenCF", o + toward); e:SetAttribute("ShutCF", sh + toward); e.CFrame = o + toward
					end
				end
				-- header over the opening, and the lamp under it
				part({ Name = "Header", Size = sized(span, WALL_H - DOOR_H, 1.1), Position = Vector3.new(cx, (DOOR_H + WALL_H) / 2, cz),
					Color = TRIM_COLOR, CanCollide = false, CanQuery = false, CanTouch = false, Parent = p })
				part({ Name = "Lamp", Size = sized(math.min(2.4, span * 0.4), 0.22, 1.2), Position = Vector3.new(cx, DOOR_H - 0.1, cz),
					Color = Color3.fromRGB(60, 220, 110), Material = Enum.Material.Neon, CanCollide = false, CanQuery = false, CanTouch = false, Parent = p })
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
		-- a round lid: metal rim, dark well, five slats across
		local UPRIGHT = CFrame.Angles(0, 0, math.rad(90))
		local v = part({ Name = "Vent", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.4, 3.4, 3.4),
			CFrame = CFrame.new(r.vent[1], 0.2, r.vent[2]) * UPRIGHT,
			Color = Color3.fromRGB(150, 155, 168), Material = Enum.Material.Metal, Parent = F.Vents })
		v:SetAttribute("Room", r.name)
		v:SetAttribute("Group", VENT_GROUPS[r.name] or "?")
		part({ Name = "Well", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.42, 2.8, 2.8), CFrame = CFrame.new(r.vent[1], 0.21, r.vent[2]) * UPRIGHT,
			Color = Color3.fromRGB(20, 20, 26), CanCollide = false, CanQuery = false, CanTouch = false, Parent = v })
		for k = -2, 2 do
			local chord = 2 * math.sqrt(1.4 ^ 2 - (k * 0.5) ^ 2)
			part({ Name = "Slat", Size = Vector3.new(chord, 0.44, 0.2), Position = Vector3.new(r.vent[1], 0.22, r.vent[2] + k * 0.5),
				Color = Color3.fromRGB(110, 115, 128), Material = Enum.Material.Metal, CanCollide = false, CanQuery = false, CanTouch = false, Parent = v })
		end
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

-- ---------- task consoles ----------
-- a wall console behind each pad, which then turns into an invisible trigger. A pad with an opening behind
-- it (Admin, MedBay, Lower Engine stand in a hall mouth) gets a floor hatch instead.
local SCREEN = {
	["Fix Wiring"] = Color3.fromRGB(230, 170, 40), ["Download Data"] = Color3.fromRGB(60, 150, 230), ["Upload Data"] = Color3.fromRGB(60, 150, 230),
	["Empty Garbage"] = Color3.fromRGB(120, 180, 70), ["Empty Chute"] = Color3.fromRGB(120, 180, 70), ["Clean O2 Filter"] = Color3.fromRGB(80, 200, 160),
	["Start Reactor"] = Color3.fromRGB(60, 200, 230), ["Unlock Manifolds"] = Color3.fromRGB(60, 200, 230), ["Prime Shields"] = Color3.fromRGB(110, 140, 255),
	["Divert Power"] = Color3.fromRGB(240, 200, 60), ["Accept Diverted Power"] = Color3.fromRGB(240, 200, 60), ["Calibrate Distributor"] = Color3.fromRGB(240, 200, 60),
	["Fuel Engines"] = Color3.fromRGB(230, 110, 50), ["Align Engine Output"] = Color3.fromRGB(230, 110, 50), ["Submit Scan"] = Color3.fromRGB(60, 210, 120),
	["Inspect Sample"] = Color3.fromRGB(60, 210, 120), ["Swipe Card"] = Color3.fromRGB(80, 200, 120), ["Chart Course"] = Color3.fromRGB(70, 130, 220),
	["Stabilize Steering"] = Color3.fromRGB(70, 130, 220), ["Clear Asteroids"] = Color3.fromRGB(80, 220, 120),
}
local CABINET, METAL = Color3.fromRGB(62, 66, 80), Color3.fromRGB(150, 155, 168)
local function nc(t) t.CanCollide = false; t.CanQuery = false; t.CanTouch = false; return t end
for _, pad in ipairs(F.Tasks:GetChildren()) do
	local px, pz = pad.Position.X, pad.Position.Z
	local wz = pz - 2.5 -- the room's north wall line
	local wallBehind = true
	for x = px - 1.5, px + 1.5, 0.5 do if walkable(x, wz - 1) then wallBehind = false end end
	local glow = SCREEN[pad:GetAttribute("Task")] or Color3.fromRGB(80, 200, 255)
	local dim = shade(glow, 0.55)
	local m = Instance.new("Model"); m.Name = "Console"; m:SetAttribute("TaskId", pad:GetAttribute("TaskId"))
	if wallBehind then
		local f = wz + 0.5 -- the wall's inside face
		part({ Name = "Cabinet", Size = Vector3.new(2.6, 2.3, 1.1), Position = Vector3.new(px, 1.15, f + 0.55), Color = CABINET, Parent = m })
		part(nc({ Name = "Desk", Size = Vector3.new(2.8, 0.22, 1.5), CFrame = CFrame.new(px, 2.45, f + 0.8) * CFrame.Angles(math.rad(22), 0, 0), Color = METAL, Parent = m }))
		part(nc({ Name = "Screen", Size = Vector3.new(2.2, 0.05, 1.0), CFrame = CFrame.new(px, 2.45, f + 0.85) * CFrame.Angles(math.rad(22), 0, 0) * CFrame.new(0, 0.13, 0),
			Color = dim, Material = Enum.Material.Neon, Parent = m }))
		part(nc({ Name = "Back", Size = Vector3.new(2.6, 2.1, 0.3), Position = Vector3.new(px, 3.6, f + 0.15), Color = CABINET, Parent = m }))
		part(nc({ Name = "Monitor", Size = Vector3.new(2.1, 1.4, 0.06), Position = Vector3.new(px, 3.7, f + 0.33), Color = dim, Material = Enum.Material.Neon, Parent = m }))
		part(nc({ Name = "Kick", Size = Vector3.new(2.7, 0.3, 1.2), Position = Vector3.new(px, 0.15, f + 0.55), Color = Color3.fromRGB(40, 42, 52), Parent = m }))
		pad.Transparency = 1
	elseif pad:GetAttribute("Task") == "Submit Scan" then
		-- the MedBay scanner: a lit disc on the floor and the emitter in the ceiling over it
		pad.Transparency = 1
		local UP = CFrame.Angles(0, 0, math.rad(90))
		part(nc({ Name = "Rim", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.34, 4.4, 4.4), CFrame = CFrame.new(px, 0.17, pz) * UP,
			Color = Color3.fromRGB(40, 200, 120), Material = Enum.Material.Neon, Parent = m }))
		part(nc({ Name = "Disc", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.38, 3.9, 3.9), CFrame = CFrame.new(px, 0.19, pz) * UP,
			Color = Color3.fromRGB(70, 76, 90), Parent = m }))
		part(nc({ Name = "Emitter", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.7, 3.4, 3.4), CFrame = CFrame.new(px, WALL_H - 0.35, pz) * UP,
			Color = Color3.fromRGB(118, 122, 136), Parent = m }))
		part(nc({ Name = "Lens", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.1, 2.6, 2.6), CFrame = CFrame.new(px, WALL_H - 0.75, pz) * UP,
			Color = Color3.fromRGB(40, 200, 120), Material = Enum.Material.Neon, Parent = m }))
	else
		-- floor hatch: grey frame (so the yellow task outline shows), dark grate, a lit centre
		pad.Color = Color3.fromRGB(120, 124, 138)
		part(nc({ Name = "Grate", Size = Vector3.new(2.0, 0.32, 2.0), Position = pad.Position, Color = Color3.fromRGB(46, 48, 58), Material = Enum.Material.DiamondPlate, Parent = m }))
		part(nc({ Name = "Light", Size = Vector3.new(1.0, 0.34, 1.0), Position = pad.Position, Color = dim, Material = Enum.Material.Neon, Parent = m }))
	end
	m.Parent = pad
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
	{ "LightsFix1", "Lights", 1, "Electrical", -37, 22, Color3.fromRGB(255, 220, 60) },
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
part({ Name = "CafeteriaTable", Shape = Enum.PartType.Cylinder, Size = Vector3.new(2.2, 9.6, 9.6),
	CFrame = CFrame.new(0, 1.1, -30) * CFrame.Angles(0, 0, math.rad(90)), Color = Color3.fromRGB(150, 152, 160), Parent = F.Props })
part({ Name = "TableTop", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.3, 10.4, 10.4), CanCollide = false, CanQuery = false,
	CFrame = CFrame.new(0, 2.25, -30) * CFrame.Angles(0, 0, math.rad(90)), Color = Color3.fromRGB(226, 228, 234), Parent = F.Props })
part({ Name = "ButtonRing", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.2, 4.2, 4.2), CanCollide = false, CanQuery = false,
	CFrame = CFrame.new(0, 2.45, -30) * CFrame.Angles(0, 0, math.rad(90)), Color = Color3.fromRGB(240, 190, 40), Parent = F.Props })
local btn = part({ Name = "EmergencyButton", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.6, 3, 3),
	CFrame = CFrame.new(0, 2.7, -30) * CFrame.Angles(0, 0, math.rad(90)), Color = Color3.fromRGB(230, 40, 40), Parent = F.Props })
btn:SetAttribute("Room", "Cafeteria")

-- lobby laptop: the wardrobe (suit colour + hat), near the spawn in Cafeteria
local stand = part({ Name = "LaptopStand", Size = Vector3.new(2.6, 2.4, 1.8), Position = Vector3.new(-10, 1.2, -15),
	Color = Color3.fromRGB(150, 152, 160), Parent = F.Props })
part({ Name = "LaptopBase", Size = Vector3.new(2, 0.12, 1.3), Position = Vector3.new(-10, 2.46, -15.1),
	Color = Color3.fromRGB(60, 62, 72), Parent = F.Props })
part({ Name = "LaptopScreen", Size = Vector3.new(2, 1.3, 0.1), CFrame = CFrame.new(-10, 3.1, -15.7) * CFrame.Angles(math.rad(-12), 0, 0),
	Color = Color3.fromRGB(70, 140, 220), Material = Enum.Material.SmoothPlastic, CanCollide = false, Parent = F.Props })
stand:SetAttribute("Wardrobe", true)

-- Security desk: Use here to watch the four cameras (client-side view, see TrollUsHUD)
local desk = part({ Name = "SecurityDesk", Size = Vector3.new(6, 2.5, 1.4), Position = Vector3.new(-54, 1.25, 3),
	Color = Color3.fromRGB(70, 74, 86), Parent = F.Props })
desk:SetAttribute("Room", "Security")
for i = -1, 1 do
	part({ Name = "Monitor", Size = Vector3.new(1.7, 1.2, 0.2), CFrame = CFrame.new(-54 + i * 1.9, 3.15, 3.2) * CFrame.Angles(math.rad(-10), 0, 0),
		Color = Color3.fromRGB(60, 120, 200), Material = Enum.Material.Neon, CanCollide = false, Parent = F.Props })
end

-- ---------- room props (3e) ----------
-- every room's furniture lives in Map.Decor.<room>. Big pieces collide (the bots path round them); trim,
-- screens and leaves don't. Each piece keeps clear of hall mouths, task pads, vents and fix pads.
local UPR = CFrame.Angles(0, 0, math.rad(90)) -- a Cylinder (axis X) stood upright
local ALONG_Z = CFrame.Angles(0, math.rad(90), 0) -- a Cylinder lying along Z
local DARK, MID, WHITE = Color3.fromRGB(62, 66, 80), Color3.fromRGB(118, 122, 136), Color3.fromRGB(226, 228, 234)
local NEON, WOOD, GRASS, METALM = Enum.Material.Neon, Enum.Material.WoodPlanks, Enum.Material.Grass, Enum.Material.Metal
local function room(name) local m = Instance.new("Model"); m.Name = name; m.Parent = F.Decor; return m end
local function opts(p, o) if o then for k, v in pairs(o) do p[k] = v end end; return p end
local function B(m, size, at, color, o) -- a block; at is a Vector3 or a CFrame
	return opts(part({ Name = "Prop", Size = size, CFrame = typeof(at) == "Vector3" and CFrame.new(at) or at, Color = color, Parent = m }), o)
end
local function C(m, x, y0, z, h, d, color, o) -- an upright cylinder standing on y0
	return opts(part({ Name = "Prop", Shape = Enum.PartType.Cylinder, Size = Vector3.new(h, d, d), CFrame = CFrame.new(x, y0 + h / 2, z) * UPR, Color = color, Parent = m }), o)
end
local function Ball(m, size, at, color, o)
	return opts(part({ Name = "Prop", Shape = Enum.PartType.Ball, Size = size, CFrame = typeof(at) == "Vector3" and CFrame.new(at) or at, Color = color, Parent = m }), o)
end
local function N(o) o = o or {}; return nc(o) end -- decoration that nothing bumps into

do -- Cafeteria: four round bench tables and a drinks machine (the meeting table is built above)
	local m = room("Cafeteria")
	for _, t in ipairs({ { -11, -38 }, { 11, -38 }, { -11, -22 }, { 11, -22 } }) do
		local x, z = t[1], t[2]
		C(m, x, 0, z, 1.9, 1.1, MID)
		C(m, x, 1.9, z, 0.3, 5.4, WHITE)
		for k = 0, 3 do
			local a = math.rad(45 + 90 * k)
			C(m, x + math.cos(a) * 3.7, 0, z + math.sin(a) * 3.7, 1.3, 1.5, Color3.fromRGB(80, 104, 168))
		end
	end
	B(m, Vector3.new(4, 7, 2), Vector3.new(-6, 3.5, -46.5), Color3.fromRGB(190, 40, 50))
	B(m, Vector3.new(2.6, 4.2, 0.1), Vector3.new(-6.5, 4.3, -45.45), Color3.fromRGB(60, 110, 150), N({ Material = NEON }))
	for k = 0, 2 do B(m, Vector3.new(2.2, 0.08, 0.12), Vector3.new(-6.5, 3.0 + k * 1.2, -45.4), Color3.fromRGB(230, 230, 240), N()) end
	B(m, Vector3.new(0.6, 2.4, 0.1), Vector3.new(-4.6, 4.6, -45.45), DARK, N())
	for k = 0, 3 do Ball(m, Vector3.new(0.3, 0.3, 0.3), Vector3.new(-4.6, 3.7 + k * 0.6, -45.38), k % 2 == 0 and Color3.fromRGB(255, 80, 80) or Color3.fromRGB(80, 220, 120), N({ Material = NEON })) end
	B(m, Vector3.new(2.6, 0.8, 0.15), Vector3.new(-6, 1.2, -45.45), Color3.fromRGB(20, 20, 26), N())
	B(m, Vector3.new(3.6, 0.6, 0.1), Vector3.new(-6, 6.5, -45.45), WHITE, N({ Material = NEON }))
end

do -- Weapons: the turret chair facing the big window
	local m = room("Weapons")
	C(m, 55, 0, -36, 0.5, 3.6, DARK)
	C(m, 55, 0.5, -36, 1.5, 0.9, MID)
	B(m, Vector3.new(2.3, 0.5, 2.3), Vector3.new(55, 2.25, -36), Color3.fromRGB(170, 40, 44))
	B(m, Vector3.new(0.5, 2.6, 2.3), Vector3.new(53.85, 3.6, -36), Color3.fromRGB(170, 40, 44))
	for s = -1, 1, 2 do
		B(m, Vector3.new(1.8, 0.4, 0.4), Vector3.new(55.2, 2.8, -36 + s * 1.3), DARK, N())
		B(m, Vector3.new(0.22, 1.0, 0.22), Vector3.new(56, 3.4, -36 + s * 1.3), DARK, N())
		Ball(m, Vector3.new(0.45, 0.45, 0.45), Vector3.new(56, 4.0, -36 + s * 1.3), Color3.fromRGB(220, 40, 40), N())
	end
	B(m, Vector3.new(1.0, 1.4, 2.4), Vector3.new(57.4, 3.6, -36), DARK, N())
	B(m, Vector3.new(0.06, 1.0, 2.0), Vector3.new(56.88, 3.6, -36), Color3.fromRGB(40, 140, 70), N({ Material = NEON }))
	B(m, Vector3.new(4.2, 0.7, 0.7), Vector3.new(59.6, 4.1, -36), MID, N({ Material = METALM }))
	-- ammo crates in the corner by the south door
	B(m, Vector3.new(3, 1.6, 2), Vector3.new(59.8, 0.8, -28), Color3.fromRGB(90, 100, 70))
	B(m, Vector3.new(2.6, 1.4, 1.8), Vector3.new(59.8, 2.3, -28.1), Color3.fromRGB(100, 110, 78))
end

do -- O2: two plant beds, three oxygen tanks
	local m = room("O2")
	local rng = Random.new(3)
	local function bed(cx, cz, w, d)
		B(m, Vector3.new(w, 1.3, d), Vector3.new(cx, 0.65, cz), Color3.fromRGB(150, 155, 168), { Material = METALM })
		B(m, Vector3.new(w - 0.4, 0.1, d - 0.4), Vector3.new(cx, 1.32, cz), Color3.fromRGB(70, 48, 30), N())
		local long = w > d and w or d
		for u = -long / 2 + 1, long / 2 - 0.9, 1.5 do
			local px, pz = w > d and cx + u or cx, w > d and cz or cz + u
			local s = rng:NextNumber(1.1, 1.6)
			Ball(m, Vector3.new(s, s * rng:NextNumber(0.8, 1.2), s), Vector3.new(px + rng:NextNumber(-0.2, 0.2), 1.6 + s * 0.3, pz + rng:NextNumber(-0.2, 0.2)),
				Color3.fromRGB(50 + rng:NextInteger(0, 30), 130 + rng:NextInteger(0, 50), 60), N({ Material = GRASS }))
		end
	end
	bed(37.6, -8, 2.4, 8)
	bed(43, -3.3, 6, 2.4)
	for _, t in ipairs({ { 41.2, -9.2 }, { 42.9, -9.2 }, { 42.05, -7.7 } }) do
		C(m, t[1], 0, t[2], 4.2, 1.4, WHITE)
		Ball(m, Vector3.new(1.4, 1.4, 1.4), Vector3.new(t[1], 4.2, t[2]), WHITE, N())
		C(m, t[1], 2.6, t[2], 0.4, 1.46, Color3.fromRGB(60, 140, 220), N())
		C(m, t[1], 4.8, t[2], 0.4, 0.3, MID, N())
	end
end

do -- Navigation: the pilot console under the wide window, two seats
	local m = room("Navigation")
	B(m, Vector3.new(2.2, 2.3, 9), Vector3.new(84.6, 1.15, -8.5), DARK)
	B(m, Vector3.new(2.8, 0.22, 9.2), CFrame.new(84.2, 2.45, -8.5) * CFrame.Angles(0, 0, math.rad(22)), MID, N())
	for k = -1, 1 do
		B(m, Vector3.new(1.6, 0.05, 2.4), CFrame.new(84.2, 2.45, -8.5 + k * 2.9) * CFrame.Angles(0, 0, math.rad(22)) * CFrame.new(0, 0.13, 0),
			k == 0 and Color3.fromRGB(40, 120, 180) or Color3.fromRGB(40, 140, 90), N({ Material = NEON }))
	end
	for _, z in ipairs({ -10.5, -6.5 }) do
		C(m, 81.2, 0, z, 1.3, 0.5, MID)
		C(m, 81.2, 1.3, z, 0.45, 1.8, Color3.fromRGB(60, 80, 140))
		B(m, Vector3.new(0.35, 1.7, 1.6), Vector3.new(80.3, 2.5, z), Color3.fromRGB(60, 80, 140))
	end
end

do -- Shields: a honeycomb of hex panels on the north wall (they light up once you prime the shields)
	local m = room("Shields")
	B(m, Vector3.new(12.2, 5.6, 0.15), Vector3.new(54, 4.6, 14.58), DARK, N())
	local s = 1.0
	for row = 0, 2 do
		for col = 0, 5 do
			local x = 48.4 + col * 1.95 + (row % 2) * 0.975
			local y = 2.8 + row * 1.72
			if x < 60 then
				for k = 0, 2 do
					local h = B(m, Vector3.new(math.sqrt(3) * s, s, 0.2), CFrame.new(x, y, 14.72) * CFrame.Angles(0, 0, math.rad(60 * k)),
						Color3.fromRGB(60, 78, 120), N())
					h.Name = "Hex"
				end
			end
		end
	end
	-- the shield emitter in the south-west corner
	C(m, 45, 0, 31, 1.0, 3.2, DARK)
	C(m, 45, 1.0, 31, 3.4, 1.0, MID, { Material = METALM })
	Ball(m, Vector3.new(1.8, 1.8, 1.8), Vector3.new(45, 4.8, 31), Color3.fromRGB(110, 140, 255), N({ Material = NEON, Transparency = 0.2 }))
end

do -- Communications: the dish console and a wall of screens
	local m = room("Communications")
	B(m, Vector3.new(5, 2.3, 1.4), Vector3.new(32.5, 1.15, 31.2), DARK)
	C(m, 32.5, 2.3, 31.2, 1.3, 0.3, MID, N())
	B(m, Vector3.new(0.3, 2.8, 2.8), CFrame.new(32.5, 4.1, 31.3) * CFrame.Angles(math.rad(60), 0, 0) * UPR, WHITE, N({ Shape = Enum.PartType.Cylinder }))
	B(m, Vector3.new(0.15, 0.15, 1.2), CFrame.new(32.5, 4.3, 31.9) * CFrame.Angles(math.rad(60), 0, 0), MID, N())
	Ball(m, Vector3.new(0.3, 0.3, 0.3), Vector3.new(32.5, 4.6, 32.4), Color3.fromRGB(255, 60, 60), N({ Material = NEON }))
	B(m, Vector3.new(10.6, 4.4, 0.2), Vector3.new(24.25, 4.75, 45.45), DARK, N())
	local tints = { Color3.fromRGB(40, 120, 170), Color3.fromRGB(40, 140, 80), Color3.fromRGB(150, 100, 40), Color3.fromRGB(40, 110, 160) }
	for col = 0, 3 do
		for row = 0, 1 do
			B(m, Vector3.new(2.2, 1.6, 0.1), Vector3.new(20.5 + col * 2.5, 3.75 + row * 2.0, 45.3), tints[(col + row) % 4 + 1], N({ Material = NEON }))
		end
	end
	B(m, Vector3.new(10, 2.3, 1.2), Vector3.new(24.25, 1.15, 44.9), Color3.fromRGB(150, 155, 168))
end

do -- Storage: crates in the middle, barrels, the fuel can rack, the garbage hatch and lever
	local m = room("Storage")
	local crate = Color3.fromRGB(150, 110, 62)
	B(m, Vector3.new(4, 4, 4), Vector3.new(0, 2, 26), crate, { Material = WOOD })
	B(m, Vector3.new(3, 3, 3), CFrame.new(2.9, 1.5, 28.6) * CFrame.Angles(0, math.rad(15), 0), shade(crate, 0.9), { Material = WOOD })
	B(m, Vector3.new(2.6, 2.6, 2.6), CFrame.new(-2.7, 1.3, 28.2) * CFrame.Angles(0, math.rad(-10), 0), shade(crate, 1.08), { Material = WOOD })
	B(m, Vector3.new(2.8, 2.8, 2.8), CFrame.new(0.4, 5.4, 26.1) * CFrame.Angles(0, math.rad(22), 0), shade(crate, 0.95), { Material = WOOD })
	for _, b in ipairs({ { -12.4, 40.3 }, { -12.4, 38.0 }, { -10.2, 40.4 } }) do
		C(m, b[1], 0, b[2], 3, 2, Color3.fromRGB(60, 100, 170))
		C(m, b[1], 0.7, b[2], 0.2, 2.06, Color3.fromRGB(40, 70, 120), N())
		C(m, b[1], 2.1, b[2], 0.2, 2.06, Color3.fromRGB(40, 70, 120), N())
	end
	for k = 0, 2 do B(m, Vector3.new(1.4, 0.2, 8), Vector3.new(13.2, 0.9 + k * 1.5, 24), MID, k == 0 and nil or N()) end
	for _, z in ipairs({ 20, 28 }) do B(m, Vector3.new(1.4, 4.6, 0.2), Vector3.new(13.2, 2.3, z), MID, N()) end
	for k = 0, 2 do
		for _, z in ipairs({ 21.2, 23.2, 25.2, 27.0 }) do
			B(m, Vector3.new(0.9, 1.1, 0.7), Vector3.new(13.1, 1.55 + k * 1.5, z), Color3.fromRGB(200, 44, 40), N())
			B(m, Vector3.new(0.3, 0.2, 0.3), Vector3.new(13.1, 2.2 + k * 1.5, z + 0.15), Color3.fromRGB(240, 200, 40), N())
		end
	end
	B(m, Vector3.new(3, 3, 0.3), Vector3.new(9, 2.5, 41.6), DARK, N())
	B(m, Vector3.new(2.4, 0.15, 0.1), Vector3.new(9, 3.6, 41.42), Color3.fromRGB(240, 190, 40), N())
	B(m, Vector3.new(0.3, 1.6, 0.3), CFrame.new(11.1, 3.2, 41.3) * CFrame.Angles(math.rad(-20), 0, 0), MID, N())
	Ball(m, Vector3.new(0.5, 0.5, 0.5), Vector3.new(11.1, 4.0, 41.0), Color3.fromRGB(220, 40, 40), N())
end

do -- Admin: the map table with the ship drawn on it, the card reader
	local m = room("Admin")
	B(m, Vector3.new(8, 2.1, 5), Vector3.new(29, 1.05, 10.5), DARK)
	B(m, Vector3.new(8.4, 0.2, 5.4), Vector3.new(29, 2.2, 10.5), MID)
	local k = 0.036
	for _, r in ipairs(ROOMS) do
		B(m, Vector3.new(r.w * k, 0.05, r.d * k), Vector3.new(29 + r.x * k, 2.33, 10.5 + r.z * k), Color3.fromRGB(40, 170, 140), N({ Material = NEON }))
	end
	for _, h in ipairs(HALLS) do
		B(m, Vector3.new(h[3] * k, 0.04, h[4] * k), Vector3.new(29 + h[1] * k, 2.32, 10.5 + h[2] * k), Color3.fromRGB(20, 90, 80), N({ Material = NEON }))
	end
	B(m, Vector3.new(0.9, 1.1, 0.7), Vector3.new(32.6, 2.85, 12.6), Color3.fromRGB(200, 200, 210), N())
	B(m, Vector3.new(0.1, 0.8, 0.1), Vector3.new(32.6, 2.95, 12.98), DARK, N())
	Ball(m, Vector3.new(0.18, 0.18, 0.18), Vector3.new(32.3, 3.25, 12.96), Color3.fromRGB(255, 60, 60), N({ Material = NEON }))
end

do -- Electrical: the breaker wall by the Lights fix, the distributor, cable trays, transformers
	local m = room("Electrical")
	B(m, Vector3.new(0.4, 4.6, 6), Vector3.new(-39.3, 3.6, 21), Color3.fromRGB(140, 144, 156))
	for col = 0, 3 do
		for row = 0, 4 do
			B(m, Vector3.new(0.2, 0.45, 0.6), Vector3.new(-39, 1.9 + row * 0.85, 18.9 + col * 1.4), row % 2 == col % 2 and DARK or Color3.fromRGB(240, 190, 40), N())
		end
	end
	B(m, Vector3.new(1.2, 3.6, 5.4), Vector3.new(-16.9, 2.6, 16), DARK)
	for k = -1, 1 do
		C(m, -17.55, 0, 16 + k * 1.6, 0.1, 1.1, ({ Color3.fromRGB(200, 160, 30), Color3.fromRGB(40, 120, 200), Color3.fromRGB(40, 180, 180) })[k + 2], N({ Material = NEON }))
			.CFrame = CFrame.new(-17.55, 3.2, 16 + k * 1.6)
	end
	B(m, Vector3.new(1.3, 0.3, 19), Vector3.new(-16.95, 7.4, 16), MID, N())
	B(m, Vector3.new(22, 0.3, 1.3), Vector3.new(-28, 6.2, 6.95), MID, N()) -- under the room sign, not across it
	for k, col in ipairs({ Color3.fromRGB(200, 40, 40), Color3.fromRGB(240, 190, 40), Color3.fromRGB(40, 90, 200) }) do
		B(m, Vector3.new(0.25, 0.25, 19), Vector3.new(-17.3 + k * 0.3, 7.7, 16), col, N())
		B(m, Vector3.new(22, 0.25, 0.25), Vector3.new(-28, 6.5, 6.6 + k * 0.3), col, N())
	end
	for _, x in ipairs({ -37.5, -34.4 }) do
		B(m, Vector3.new(2.6, 4, 1.4), Vector3.new(x, 2, 25.1), Color3.fromRGB(110, 114, 128))
		B(m, Vector3.new(1.6, 0.5, 0.1), Vector3.new(x, 3.2, 24.35), Color3.fromRGB(240, 190, 40), N())
	end
end

do -- MedBay: two beds, the sample bench (the scanner is built on the Submit Scan pad, with the consoles)
	local m = room("MedBay")
	local function bedAt(cx, cz, alongX)
		local sz = function(a, h, b) return alongX and Vector3.new(b, h, a) or Vector3.new(a, h, b) end
		B(m, sz(3.2, 1.3, 5.6), Vector3.new(cx, 0.65, cz), WHITE)
		B(m, sz(2.9, 0.3, 5.2), Vector3.new(cx, 1.45, cz), Color3.fromRGB(140, 200, 230), N())
		local pz = alongX and Vector3.new(cx - 2.0, 1.75, cz) or Vector3.new(cx, 1.75, cz - 2.0)
		B(m, sz(2.2, 0.35, 1.0), pz, Color3.fromRGB(245, 245, 250), N())
	end
	bedAt(-41.6, -25, false)
	bedAt(-34, -15.9, true)
	B(m, Vector3.new(1.8, 2.5, 6), Vector3.new(-24.95, 1.25, -25), WHITE)
	for k = 0, 4 do
		C(m, -25.1, 2.5, -27.2 + k * 1.1, 0.9, 0.35, ({ Color3.fromRGB(220, 60, 60), Color3.fromRGB(60, 160, 220), Color3.fromRGB(80, 200, 100) })[k % 3 + 1], N({ Transparency = 0.25 }))
	end
end

local function engine(name, cz, pipeZ)
	local m = room(name)
	local x0 = -74 -- the engine's back is in the west wall; it points into the room
	B(m, Vector3.new(9, 0.8, 5), Vector3.new(x0 + 4.5, 0.4, cz), DARK)
	B(m, Vector3.new(10, 6, 6), CFrame.new(x0 + 5, 3.6, cz), MID, { Shape = Enum.PartType.Cylinder, Material = METALM })
	for k = 0, 2 do
		B(m, Vector3.new(0.5, 6.5, 6.5), CFrame.new(x0 + 2.5 + k * 2.6, 3.6, cz), DARK, N({ Shape = Enum.PartType.Cylinder }))
	end
	Ball(m, Vector3.new(5.4, 5.4, 5.4), Vector3.new(x0 + 9, 3.6, cz), shade(MID, 1.15), N({ Material = METALM }))
	Ball(m, Vector3.new(1.6, 1.6, 1.6), Vector3.new(x0 + 11.2, 3.6, cz), Color3.fromRGB(255, 140, 50), N({ Material = NEON }))
	for _, dz in ipairs({ -1.6, 1.6 }) do C(m, x0 + 4, 6.4, cz + dz, WALL_H - 6.4, 0.7, DARK, N()) end
	B(m, Vector3.new(0.8, 0.8, 0.8), Vector3.new(x0 + 7, 2.4, cz + 3.1), Color3.fromRGB(240, 190, 40), N()) -- the fuel port
	for k = 0, 1 do
		B(m, Vector3.new(23, 0.7, 0.7), Vector3.new(-62, 6.8 + k * 0.9, pipeZ), k == 0 and DARK or MID, N({ Shape = Enum.PartType.Cylinder }))
	end
end
engine("Upper Engine", -33, -45.3)
engine("Lower Engine", 30, 41.3)

do -- Security: a chair at the camera desk, server racks
	local m = room("Security")
	C(m, -54, 0, 0.7, 1.3, 0.5, MID)
	C(m, -54, 1.3, 0.7, 0.4, 1.7, Color3.fromRGB(60, 70, 110))
	B(m, Vector3.new(1.7, 1.7, 0.35), Vector3.new(-54, 2.55, -0.2), Color3.fromRGB(60, 70, 110))
	B(m, Vector3.new(1.2, 6, 4), Vector3.new(-46.8, 3, -9), DARK) -- north of the vent: further south it closed the bots' path to it
	local rng = Random.new(9)
	for row = 0, 6 do
		B(m, Vector3.new(0.05, 0.12, 3.2), Vector3.new(-47.42, 0.9 + row * 0.75, -9), Color3.fromRGB(30, 32, 40), N())
		Ball(m, Vector3.new(0.14, 0.14, 0.14), Vector3.new(-47.42, 1.05 + row * 0.75, -10.4 + rng:NextNumber(0, 2.8)),
			rng:NextNumber() < 0.5 and Color3.fromRGB(60, 230, 110) or Color3.fromRGB(255, 170, 40), N({ Material = NEON }))
	end
end

do -- Reactor: the core in the middle, the two hold panels by the fix pads, pipes
	local m = room("Reactor")
	C(m, -86, 0, -3, 1, 7, DARK)
	C(m, -86, 1, -3, WALL_H - 2, 3.6, Color3.fromRGB(40, 150, 200), { Material = NEON, Transparency = 0.15 })
	for _, y in ipairs({ 2.4, 4.4, 6.4 }) do C(m, -86, y, -3, 0.35, 5, MID, N({ Material = METALM })) end
	for k = 0, 3 do
		local a = math.rad(45 + k * 90)
		C(m, -86 + math.cos(a) * 2.4, 1, -3 + math.sin(a) * 2.4, WALL_H - 2, 0.35, MID, N())
	end
	C(m, -86, WALL_H - 1, -3, 1, 6, DARK)
	for _, hp in ipairs({ { -93.4, -12, 1 }, { -74.6, 6, -1 } }) do
		local x, z, face = hp[1], hp[2], hp[3]
		B(m, Vector3.new(0.6, 3.4, 2.4), Vector3.new(x, 3, z), DARK)
		B(m, Vector3.new(0.06, 1.8, 1.4), Vector3.new(x + face * 0.32, 3.3, z), Color3.fromRGB(60, 200, 230), N({ Material = NEON }))
	end
	for _, z in ipairs({ -9, 7 }) do C(m, -93.2, 0, z, WALL_H, 0.8, MID, N()) end -- either side of the room sign
end

-- ---------- room name signs ----------
-- a plate high on the first solid stretch of wall: north, then south, west, east
for _, r in ipairs(ROOMS) do
	local x1, x2, z1, z2 = rect(r)
	local tries = {
		{ x = r.x, z = z1 + 0.55, out = Vector3.new(0, 0, -1.1), face = Enum.NormalId.Back, size = Vector3.new(7, 1.3, 0.1), alongX = true },
		{ x = r.x, z = z2 - 0.55, out = Vector3.new(0, 0, 1.1), face = Enum.NormalId.Front, size = Vector3.new(7, 1.3, 0.1), alongX = true },
		{ x = x1 + 0.55, z = r.z, out = Vector3.new(-1.1, 0, 0), face = Enum.NormalId.Right, size = Vector3.new(0.1, 1.3, 7), alongX = false },
		{ x = x2 - 0.55, z = r.z, out = Vector3.new(1.1, 0, 0), face = Enum.NormalId.Left, size = Vector3.new(0.1, 1.3, 7), alongX = false },
	}
	for _, t in ipairs(tries) do
		local ok = true
		for u = -3.5, 3.5, 1 do
			local px, pz = t.x + (t.alongX and u or 0) + t.out.X, t.z + (t.alongX and 0 or u) + t.out.Z
			if walkable(px, pz) then ok = false end
		end
		if ok then
			local plate = part(nc({ Name = "Sign", Size = t.size, Position = Vector3.new(t.x, 7.9, t.z), Color = Color3.fromRGB(36, 38, 48), Parent = F.Decor }))
			local gui = Instance.new("SurfaceGui"); gui.Face = t.face; gui.CanvasSize = Vector2.new(700, 130); gui.LightInfluence = 0.3; gui.Parent = plate
			local tl = Instance.new("TextLabel"); tl.Size = UDim2.fromScale(1, 1); tl.BackgroundTransparency = 1
			tl.Text = string.upper(r.name); tl.Font = Enum.Font.GothamBlack; tl.TextScaled = true
			tl.TextColor3 = Color3.fromRGB(240, 242, 248); tl.Parent = gui
			local pad = Instance.new("UIPadding"); pad.PaddingTop = UDim.new(0, 18); pad.PaddingBottom = UDim.new(0, 18); pad.Parent = tl
			break
		end
	end
end
task.wait()

-- ceilings: one dark slab per room and hall plus a light panel per room. CastShadow off so the sun still
-- lights the floors (the ship has no interior lights yet)
local CEIL = Color3.fromRGB(44, 46, 56)
local function ceiling(x, z, w, d)
	part({ Name = "Ceiling", Size = Vector3.new(w + 1, 1, d + 1), Position = Vector3.new(x, WALL_H + 0.5, z),
		Color = CEIL, CastShadow = false, Parent = F.Ceiling })
end
for _, r in ipairs(ROOMS) do
	ceiling(r.x, r.z, r.w, r.d)
	local panel = part({ Name = "LightPanel", Size = Vector3.new(math.max(4, r.w * 0.45), 0.1, 1.6), Position = Vector3.new(r.x, WALL_H - 0.05, r.z),
		Color = Color3.fromRGB(235, 240, 255), Material = Enum.Material.Neon, CanCollide = false, CanQuery = false, CastShadow = false, Parent = F.Ceiling })
	-- one tinted light per room (the client switches it off for Lights out)
	local light = Instance.new("PointLight")
	light.Color = r.light or Color3.fromRGB(235, 240, 255)
	light.Range = math.min(60, math.max(r.w, r.d) * 0.9)
	light.Brightness = 0.5; light.Shadows = false
	light.Parent = panel
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
