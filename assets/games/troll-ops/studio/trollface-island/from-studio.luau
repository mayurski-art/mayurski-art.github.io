--!nocheck
-- Trollface Island back out of Studio (doc "Troll Royale map in Roblox
-- Studio"). Run in the place's Edit datamodel over the Studio MCP while
-- tools/troll-ops-island-from-studio.mjs listens (port 5296 unless PORT is
-- set). Phase 1 sends the colliders: each part in TrollfaceIsland/Colliders
-- as the game's AABB (a rotated part gives its world bounding box), in its
-- `i` order, new parts after; `n` is its landmark (attribute, else the name
-- up to "_"), `pen` its bullet loss (attribute, else 0.9).

local PORT = PORT or 5296
local HttpService = game:GetService("HttpService")
local root = workspace:FindFirstChild("TrollfaceIsland")
if not root or not root:FindFirstChild("Colliders") then error("no TrollfaceIsland/Colliders: run build-island.luau first") end
local S = root:GetAttribute("studsPerM") or 3

local parts = {}
for _, p in ipairs(root.Colliders:GetDescendants()) do
	if p:IsA("BasePart") then table.insert(parts, p) end
end
table.sort(parts, function(a, b)
	local ia, ib = a:GetAttribute("i") or math.huge, b:GetAttribute("i") or math.huge
	if ia ~= ib then return ia < ib end
	return a:GetFullName() < b:GetFullName()
end)

local out = {}
for _, p in ipairs(parts) do
	-- World AABB of the part's box.
	local cf, half = p.CFrame, p.Size / 2
	local ex = math.abs(cf.RightVector.X) * half.X + math.abs(cf.UpVector.X) * half.Y + math.abs(cf.LookVector.X) * half.Z
	local ey = math.abs(cf.RightVector.Y) * half.X + math.abs(cf.UpVector.Y) * half.Y + math.abs(cf.LookVector.Y) * half.Z
	local ez = math.abs(cf.RightVector.Z) * half.X + math.abs(cf.UpVector.Z) * half.Y + math.abs(cf.LookVector.Z) * half.Z
	local c = cf.Position
	table.insert(out, {
		n = p:GetAttribute("n") or string.match(p.Name, "^([^_]+)") or "ground",
		x = c.X / S, z = c.Z / S,
		w = 2 * ex / S, d = 2 * ez / S, h = 2 * ey / S,
		y = (c.Y - ey) / S,
		pen = p:GetAttribute("pen") or 0.9,
	})
end

-- Phase 3: the terrain. Each voxel column's top (the highest solid voxel,
-- filled to its occupancy) and its material, then sampled at the game's 2 m
-- grid points (heights, cm) and the paint mask's 2 m cells (one material
-- code each: 0 none, 1 grass, 2 sand, 3 path, 4 rock, 5 lake).
local bounds = HttpService:JSONDecode(root:GetAttribute("bounds"))
local V, BASE, LAYERS = 4, -12, 7
local x0 = math.floor(bounds.minX * S / V) * V
local z0 = math.floor(bounds.minZ * S / V) * V
local nx = math.ceil((bounds.maxX * S - x0) / V)
local nz = math.ceil((bounds.maxZ * S - z0) / V)
local CODE = { Grass = 1, LeafyGrass = 1, Sand = 2, Sandstone = 2, Ground = 3, Mud = 3, Pavement = 3, Concrete = 3,
	Rock = 4, Slate = 4, Basalt = 4, Limestone = 4 }
local tops, codes = {}, {}
for zs = 0, nz - 1, 16 do
	local rows = math.min(16, nz - zs)
	local lo = Vector3.new(x0, BASE, z0 + zs * V)
	local mats, occ = workspace.Terrain:ReadVoxels(Region3.new(lo, lo + Vector3.new(nx * V, LAYERS * V, rows * V)), V)
	for ix = 1, nx do
		for iz = 1, rows do
			local top, code, water = nil, 0, false
			for iy = LAYERS, 1, -1 do
				local m, o = mats[ix][iy][iz], occ[ix][iy][iz]
				if m == Enum.Material.Water then water = true
				elseif m ~= Enum.Material.Air and o > 0 then
					top = BASE + (iy - 1) * V + o * V
					code = CODE[m.Name] or 1
					break
				end
			end
			if water and code ~= 0 then code = 5 end
			local k = (zs + iz - 1) * nx + ix
			tops[k], codes[k] = top and top / S or false, code
		end
	end
	task.wait()
end
local function voxel(xm, zm)
	local ix = math.floor((xm * S - x0) / V) + 1
	local iz = math.floor((zm * S - z0) / V) + 1
	if ix < 1 or iz < 1 or ix > nx or iz > nz then return nil end
	return (iz - 1) * nx + ix
end
local CELL, RES = 2, 2
local gw = math.floor((bounds.maxX - bounds.minX) / CELL + 0.5) + 1
local gh = math.floor((bounds.maxZ - bounds.minZ) / CELL + 0.5) + 1
-- A grid point's height: the four voxel columns round it, blended by
-- distance to their centres (the column it's in alone was up to 0.7 m off).
local function topAt(ix, iz)
	if ix < 1 or iz < 1 or ix > nx or iz > nz then return 0 end
	return tops[(iz - 1) * nx + ix] or 0
end
local heights = table.create(gw * gh, 0)
for j = 0, gh - 1 do
	for i = 0, gw - 1 do
		local u = ((bounds.minX + i * CELL) * S - x0) / V - 0.5
		local v = ((bounds.minZ + j * CELL) * S - z0) / V - 0.5
		local iu, iv = math.floor(u), math.floor(v)
		local fu, fv = u - iu, v - iv
		local a = topAt(iu + 1, iv + 1) + (topAt(iu + 2, iv + 1) - topAt(iu + 1, iv + 1)) * fu
		local b = topAt(iu + 1, iv + 2) + (topAt(iu + 2, iv + 2) - topAt(iu + 1, iv + 2)) * fu
		heights[j * gw + i + 1] = math.floor(math.max(0, a + (b - a) * fv) * 100 + 0.5)
	end
end
local mw = math.ceil((bounds.maxX - bounds.minX) / RES)
local mh = math.ceil((bounds.maxZ - bounds.minZ) / RES)
local paint = table.create(mh)
for j = 0, mh - 1 do
	local row = table.create(mw)
	for i = 0, mw - 1 do
		local k = voxel(bounds.minX + (i + 0.5) * RES, bounds.minZ + (j + 0.5) * RES)
		row[i + 1] = tostring(k and codes[k] or 0)
	end
	paint[j + 1] = table.concat(row)
end
local terrain = { minX = bounds.minX, minZ = bounds.minZ, cell = CELL, w = gw, h = gh, heights = heights,
	paint = { res = RES, w = mw, h = mh, cells = table.concat(paint) } }

local HS = HttpService.HttpEnabled
HttpService.HttpEnabled = true
local ok, res = pcall(function()
	local a = HttpService:PostAsync(("http://localhost:%d/colliders"):format(PORT), HttpService:JSONEncode(out), Enum.HttpContentType.ApplicationJson)
	local b = HttpService:PostAsync(("http://localhost:%d/terrain"):format(PORT), HttpService:JSONEncode(terrain), Enum.HttpContentType.ApplicationJson)
	return a .. "; " .. b
end)
HttpService.HttpEnabled = HS
if not ok then error("post: " .. tostring(res)) end
return ("sent %d colliders and the terrain (%dx%d points): %s"):format(#out, gw, gh, res)
