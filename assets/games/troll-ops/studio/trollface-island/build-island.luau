--!nocheck
-- Trollface Island into a Studio place (doc "Troll Royale map in Roblox
-- Studio", phase 1). Run in the place's Edit datamodel over the Studio MCP
-- while the checkout is served (node tools/static-serve.mjs <port>); it reads
-- island.json (tools/troll-ops-island-to-studio.mjs writes it) and lays out:
--   Terrain             the island top at y 0, painted per 2 m cell (grass,
--                       sand, path, rock), the lake as shallow water
--   TrollfaceIsland/Colliders   one see-through part per game collider, named
--                       <landmark>_<i>; attributes i (order), n, pen. Edit
--                       these: troll-ops-island-from-studio.luau writes them
--                       back to the game
--   TrollfaceIsland/Markers     POI rings, spawns, deck loot: locked, gameplay
--                       reads them from the game's files, not from here
-- 1 m = 3 studs. Game x/z are Studio X/Z (north is -Z), y is up.
-- Set PORT before running if the server isn't on 5193.

local PORT = PORT or 5193
local HttpService = game:GetService("HttpService")
local was = HttpService.HttpEnabled
HttpService.HttpEnabled = true
local ok, body = pcall(function()
	return HttpService:GetAsync(("http://localhost:%d/assets/games/troll-ops/studio/trollface-island/island.json?t=%d"):format(PORT, os.time()))
end)
HttpService.HttpEnabled = was
if not ok then error("island.json: " .. tostring(body)) end
local D = HttpService:JSONDecode(body)
local S = D.studsPerM

-- Start clean: the old build and the template's baseplate and spawn.
for _, name in ipairs({ "TrollfaceIsland", "Baseplate", "SpawnLocation" }) do
	local old = workspace:FindFirstChild(name)
	if old then old:Destroy() end
end
local root = Instance.new("Folder")
root.Name = "TrollfaceIsland"
root:SetAttribute("studsPerM", S)
root:SetAttribute("bounds", HttpService:JSONEncode(D.bounds))

---------------------------------------------------------------- terrain
local T = workspace.Terrain
T:Clear()
local V = 4                                      -- voxel size, studs
local M = D.mask
local x0 = math.floor(D.bounds.minX * S / V) * V
local z0 = math.floor(D.bounds.minZ * S / V) * V
local nx = math.ceil((D.bounds.maxX * S - x0) / V)
local nz = math.ceil((D.bounds.maxZ * S - z0) / V)
local TOP = {
	["1"] = Enum.Material.Grass, ["2"] = Enum.Material.Sand, ["3"] = Enum.Material.Ground,
	["4"] = Enum.Material.Rock, ["5"] = Enum.Material.Sand,
}
local waterOcc = math.clamp(D.waterY * S / V, 0.05, 1)
local function cellAt(sx, sz)                    -- stud X/Z -> mask char
	local i = math.floor((sx / S - D.bounds.minX) / M.res)
	local j = math.floor((sz / S - D.bounds.minZ) / M.res)
	if i < 0 or j < 0 or i >= M.w or j >= M.h then return "0" end
	local k = j * M.w + i + 1
	return string.sub(M.cells, k, k)
end
-- Layers bottom up: rock, earth, the painted top (its top face at y 0), then
-- one layer of air or the lake's water.
local LAYERS = 4
local ROWS = 24
for zs = 0, nz - 1, ROWS do
	local rows = math.min(ROWS, nz - zs)
	local mats, occ = {}, {}
	for ix = 1, nx do
		mats[ix], occ[ix] = {}, {}
		for iy = 1, LAYERS do
			mats[ix][iy], occ[ix][iy] = {}, {}
		end
		local sx = x0 + (ix - 0.5) * V
		for iz = 1, rows do
			local c = cellAt(sx, z0 + (zs + iz - 0.5) * V)
			local land = c ~= "0"
			mats[ix][1][iz] = land and Enum.Material.Rock or Enum.Material.Air
			mats[ix][2][iz] = land and Enum.Material.Ground or Enum.Material.Air
			mats[ix][3][iz] = land and TOP[c] or Enum.Material.Air
			mats[ix][4][iz] = c == "5" and Enum.Material.Water or Enum.Material.Air
			occ[ix][1][iz] = land and 1 or 0
			occ[ix][2][iz] = land and 1 or 0
			occ[ix][3][iz] = land and 1 or 0
			occ[ix][4][iz] = c == "5" and waterOcc or 0
		end
	end
	local lo = Vector3.new(x0, -3 * V, z0 + zs * V)
	T:WriteVoxels(Region3.new(lo, lo + Vector3.new(nx * V, LAYERS * V, rows * V)), V, mats, occ)
	task.wait()
end

---------------------------------------------------------------- colliders
local function tint(name)
	local h = 0
	for k = 1, #name do h = (h * 31 + string.byte(name, k)) % 997 end
	return Color3.fromHSV(h / 997, 0.55, 0.95)
end
local cols = Instance.new("Folder")
cols.Name = "Colliders"
for i, c in ipairs(D.colliders) do
	local p = Instance.new("Part")
	p.Name = ("%s_%d"):format(c.n, i)
	p.Anchored = true
	p.Size = Vector3.new(c.w * S, c.h * S, c.d * S)
	p.CFrame = CFrame.new(c.x * S, (c.y + c.h / 2) * S, c.z * S)
	p.Transparency = 0.45
	p.Material = Enum.Material.SmoothPlastic
	p.Color = c.n == "ground" and Color3.fromRGB(200, 200, 205) or tint(c.n)
	p.TopSurface, p.BottomSurface = Enum.SurfaceType.Smooth, Enum.SurfaceType.Smooth
	p:SetAttribute("i", i)
	p:SetAttribute("n", c.n)
	p:SetAttribute("pen", c.pen)
	p.Parent = cols
end
cols.Parent = root

---------------------------------------------------------------- markers
local marks = Instance.new("Folder")
marks.Name = "Markers"
local function mark(name, cf, size, color, shape)
	local p = Instance.new("Part")
	p.Name = name
	p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch, p.Locked = true, false, false, false, true
	p.CastShadow = false
	if shape then p.Shape = shape end
	p.Size, p.CFrame = size, cf
	p.Color, p.Material, p.Transparency = color, Enum.Material.Neon, 0.6
	p.Parent = marks
	return p
end
local TIER = { hot = Color3.fromRGB(255, 70, 70), mid = Color3.fromRGB(255, 170, 40), minor = Color3.fromRGB(120, 200, 255) }
for key, l in pairs(D.landmarks) do
	local ring = mark("POI_" .. key, CFrame.new(l.x * S, 0.3, l.z * S) * CFrame.Angles(0, 0, math.rad(90)),
		Vector3.new(0.4, l.r * 2 * S, l.r * 2 * S), TIER[l.tier] or TIER.minor, Enum.PartType.Cylinder)
	ring.Transparency = 0.85
	ring:SetAttribute("name", l.name)
	ring:SetAttribute("tier", l.tier)
	ring:SetAttribute("r", l.r)
end
for i, s in ipairs(D.spawns) do
	mark(("Spawn_%d"):format(i), CFrame.new(s[1] * S, 1.5, s[2] * S), Vector3.new(3, 3, 3), Color3.fromRGB(80, 255, 120))
end
for i, l in ipairs(D.lootExtra) do
	mark(("DeckLoot_%d"):format(i), CFrame.new(l.x * S, (l.y + 0.3) * S, l.z * S), Vector3.new(1.5, 1.5, 1.5), Color3.fromRGB(255, 230, 60))
end
marks.Parent = root
root.Parent = workspace

local cam = workspace.CurrentCamera
cam.CFrame = CFrame.lookAt(Vector3.new(0, 900, 900), Vector3.new(0, 0, 0))
return ("island built: %d x %d voxels, %d colliders, %d markers"):format(nx, nz, #cols:GetChildren(), #marks:GetChildren())
