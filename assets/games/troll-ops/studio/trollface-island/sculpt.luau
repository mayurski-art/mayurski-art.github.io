--!nocheck
-- Trollface Island's hills into the Studio place's terrain (doc "Troll Royale
-- map in Roblox Studio", phase 3). Run in the Edit datamodel over the Studio
-- MCP while the checkout is served (node tools/static-serve.mjs <port>); it
-- reads island.json (the paint) and sculpt.json (tools/troll-ops-island-
-- sculpt.mjs: the heights) and rewrites the terrain: painted top, earth and
-- rock under it, the lake's water. Only the terrain; the Colliders and
-- Markers stay as they are. After this, sculpt by hand: from-studio.luau
-- reads the terrain back, and the export keeps the coast, lake, paths, POI
-- floors and every collider's footing flat whatever the sculpt does there.

local PORT = PORT or 5193
local HttpService = game:GetService("HttpService")
local function get(name)
	local was = HttpService.HttpEnabled
	HttpService.HttpEnabled = true
	local ok, body = pcall(function()
		return HttpService:GetAsync(("http://localhost:%d/assets/games/troll-ops/studio/trollface-island/%s?t=%d"):format(PORT, name, os.time()))
	end)
	HttpService.HttpEnabled = was
	if not ok then error(name .. ": " .. tostring(body)) end
	return HttpService:JSONDecode(body)
end
local D, G = get("island.json"), get("sculpt.json")
local S = D.studsPerM

-- Bilinear height (m) from the sculpt's grid points.
local function heightAt(x, z)
	local u, v = (x - G.minX) / G.cell, (z - G.minZ) / G.cell
	if u < 0 or v < 0 or u > G.w - 1 or v > G.h - 1 then return 0 end
	local i, j = math.min(G.w - 2, math.floor(u)), math.min(G.h - 2, math.floor(v))
	local fu, fv, k = u - i, v - j, j * G.w + i + 1
	local H = G.heights
	local a = H[k] + (H[k + 1] - H[k]) * fu
	local b = H[k + G.w] + (H[k + G.w + 1] - H[k + G.w]) * fu
	return (a + (b - a) * fv) / 100
end

local T = workspace.Terrain
T:Clear()
local V = 4
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
local function cellAt(sx, sz)
	local i = math.floor((sx / S - D.bounds.minX) / M.res)
	local j = math.floor((sz / S - D.bounds.minZ) / M.res)
	if i < 0 or j < 0 or i >= M.w or j >= M.h then return "0" end
	local k = j * M.w + i + 1
	return string.sub(M.cells, k, k)
end
local BASE = -3 * V                     -- three solid layers under y 0
local LAYERS = 3 + 4                    -- and up to 16 studs (5.3 m) above
local ROWS = 16
local hiTop = 0
for zs = 0, nz - 1, ROWS do
	local rows = math.min(ROWS, nz - zs)
	local mats, occ = {}, {}
	for ix = 1, nx do
		mats[ix], occ[ix] = {}, {}
		for iy = 1, LAYERS do mats[ix][iy], occ[ix][iy] = {}, {} end
		local sx = x0 + (ix - 0.5) * V
		for iz = 1, rows do
			local sz = z0 + (zs + iz - 0.5) * V
			local c = cellAt(sx, sz)
			local land = c ~= "0"
			local top = land and heightAt(sx / S, sz / S) * S or 0      -- studs over y 0
			if top > hiTop then hiTop = top end
			for iy = 1, LAYERS do
				local lo = BASE + (iy - 1) * V
				local o = 0
				if land then o = math.clamp((top - lo) / V, 0, 1) end
				local m = Enum.Material.Air
				if o > 0 then
					-- The painted top, two layers deep: Studio drops a top voxel
					-- that's only a sliver full, and the one under it shows.
					if lo + V >= top - V then m = TOP[c] or Enum.Material.Grass
					elseif lo + V >= top - 2 * V then m = Enum.Material.Ground
					else m = Enum.Material.Rock end
				elseif c == "5" and lo == 0 then
					m, o = Enum.Material.Water, waterOcc
				end
				-- A thin top still paints: a layer under 2% full reads as air.
				if o > 0 and o < 0.02 then o, m = 0, Enum.Material.Air end
				mats[ix][iy][iz], occ[ix][iy][iz] = m, o
			end
		end
	end
	local lo = Vector3.new(x0, BASE, z0 + zs * V)
	T:WriteVoxels(Region3.new(lo, lo + Vector3.new(nx * V, LAYERS * V, rows * V)), V, mats, occ)
	task.wait()
end
return ("sculpted: top %.1f studs (%.2f m)"):format(hiTop, hiTop / S)
