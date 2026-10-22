--!nocheck
-- Trollface Island's trees, rocks and cover into the Studio place (doc
-- "Troll Royale map in Roblox Studio", phase 4). Run in the Edit datamodel
-- over the Studio MCP while the checkout is served (node tools/static-serve.mjs
-- <port>); reads props.json (tools/troll-ops-island-props.mjs writes it) and
-- lays out:
--   ServerStorage/IslandPropKinds   one stand-in model per kind (oak, pine,
--                       bush, boulder, rockwall, crates, hay, logs, barrels,
--                       sandbags): copy one to add a prop of that kind
--   TrollfaceIsland/Props           one model per prop, attribute Kind. Move,
--                       turn (around Y), scale (Model scale), copy or delete
--                       them; from-studio.luau sends them back. Height is the
--                       ground's: the game stands every prop on the terrain.
-- The stand-ins are only for placing: the game draws its own trees and crates
-- (maps/island-props.js), the same size and footprint.
-- It also takes the old tree trunks and boulders out of TrollfaceIsland/
-- Colliders: props bring their own colliders now.

local PORT = PORT or 5193
local HttpService = game:GetService("HttpService")
local ServerStorage = game:GetService("ServerStorage")
local was = HttpService.HttpEnabled
HttpService.HttpEnabled = true
local ok, body = pcall(function()
	return HttpService:GetAsync(("http://localhost:%d/assets/games/troll-ops/studio/trollface-island/props.json?t=%d"):format(PORT, os.time()))
end)
HttpService.HttpEnabled = was
if not ok then error("props.json: " .. tostring(body)) end
local D = HttpService:JSONDecode(body)
local root = workspace:FindFirstChild("TrollfaceIsland")
if not root then error("no TrollfaceIsland: run build-island.luau first") end
local S = root:GetAttribute("studsPerM") or 3

---------------------------------------------------------------- the kinds
local old = ServerStorage:FindFirstChild("IslandPropKinds")
if old then old:Destroy() end
local kindsFolder = Instance.new("Folder")
kindsFolder.Name = "IslandPropKinds"

local function part(model, shape, size, pos, color, material, rot)
	local p = Instance.new("Part")
	p.Shape = shape
	p.Size = size * S
	p.CFrame = CFrame.new(pos * S) * (rot or CFrame.new())
	p.Color = color
	p.Material = material
	p.Anchored = true
	p.CanCollide = false
	p.TopSurface, p.BottomSurface = Enum.SurfaceType.Smooth, Enum.SurfaceType.Smooth
	p.Parent = model
	return p
end
local BLOCK, BALL, CYL = Enum.PartType.Block, Enum.PartType.Ball, Enum.PartType.Cylinder
local UP = CFrame.Angles(0, 0, math.pi / 2)          -- a Cylinder's axis is X: stand it up
local V = Vector3.new
local GREEN, PINE, BARK = Color3.fromRGB(63, 166, 82), Color3.fromRGB(38, 110, 72), Color3.fromRGB(107, 74, 46)
local ROCK, WOOD, HAY = Color3.fromRGB(150, 148, 142), Color3.fromRGB(176, 136, 88), Color3.fromRGB(217, 180, 74)
local M = Enum.Material

local BUILD = {
	oak = function(m)
		part(m, CYL, V(3.2, 0.6, 0.6), V(0, 1.6, 0), BARK, M.Wood, UP)
		part(m, BALL, V(4.8, 4.8, 4.8), V(0, 4.4, 0), GREEN, M.Grass)
	end,
	pine = function(m)
		part(m, CYL, V(2.6, 0.6, 0.6), V(0, 1.3, 0), BARK, M.Wood, UP)
		for k = 0, 2 do
			local w = 3.8 * (1 - k * 0.26)
			part(m, BLOCK, V(w, 1.6, w), V(0, 2.6 + k * 1.45, 0), PINE, M.Grass, CFrame.Angles(0, math.rad(45 * k), 0))
		end
	end,
	bush = function(m) part(m, BALL, V(1.8, 1.8, 1.8), V(0, 0.5, 0), GREEN, M.Grass) end,
	boulder = function(m) part(m, BLOCK, V(3.3, 1.8, 2.7), V(0, 0.9, 0), ROCK, M.Rock) end,
	rockwall = function(m) part(m, BLOCK, V(4, 1.15, 0.9), V(0, 0.575, 0), ROCK, M.Slate) end,
	crates = function(m)
		part(m, BLOCK, V(1.1, 1.1, 1.1), V(-0.6, 0.55, 0), WOOD, M.WoodPlanks)
		part(m, BLOCK, V(1.1, 1.1, 1.1), V(0.6, 0.55, 0.05), WOOD, M.WoodPlanks)
		part(m, BLOCK, V(1.1, 1.1, 1.1), V(-0.05, 1.65, 0), WOOD, M.WoodPlanks)
	end,
	hay = function(m)
		part(m, CYL, V(1.3, 1.5, 1.5), V(0, 0.75, -0.78), HAY, M.Fabric)
		part(m, CYL, V(1.3, 1.5, 1.5), V(0, 0.75, 0.78), HAY, M.Fabric)
	end,
	logs = function(m)
		part(m, CYL, V(4, 0.66, 0.66), V(0, 0.33, -0.34), BARK, M.Wood)
		part(m, CYL, V(4, 0.66, 0.66), V(0, 0.33, 0.34), BARK, M.Wood)
		part(m, CYL, V(4, 0.66, 0.66), V(0, 0.88, 0), BARK, M.Wood)
	end,
	barrels = function(m)
		part(m, CYL, V(1, 0.76, 0.76), V(-0.45, 0.5, -0.2), Color3.fromRGB(192, 57, 43), M.Metal, UP)
		part(m, CYL, V(1, 0.76, 0.76), V(0.42, 0.5, -0.25), Color3.fromRGB(46, 111, 181), M.Metal, UP)
		part(m, CYL, V(1, 0.76, 0.76), V(0, 0.5, 0.48), Color3.fromRGB(192, 57, 43), M.Metal, UP)
	end,
	sandbags = function(m) part(m, BLOCK, V(3, 1.05, 0.65), V(0, 0.525, 0), Color3.fromRGB(181, 159, 114), M.Fabric) end,
}
for _, name in ipairs(D.kinds) do
	local m = Instance.new("Model")
	m.Name = name
	m:SetAttribute("Kind", name)
	BUILD[name](m)
	m.WorldPivot = CFrame.new()                 -- the pivot is the foot: ground, centre
	m.Parent = kindsFolder
end
kindsFolder.Parent = ServerStorage

---------------------------------------------------------------- the props
local oldProps = root:FindFirstChild("Props")
if oldProps then oldProps:Destroy() end
local props = Instance.new("Folder")
props.Name = "Props"
props.Parent = root
local params = RaycastParams.new()
params.FilterType = Enum.RaycastFilterType.Include
params.FilterDescendantsInstances = { workspace.Terrain }
local function groundAt(x, z)
	local hit = workspace:Raycast(V(x, 200, z), V(0, -400, 0), params)
	return hit and hit.Position.Y or 0
end
local chunk = Instance.new("Folder")
for i, it in ipairs(D.items) do
	local name = D.kinds[it[1] + 1]
	local m = kindsFolder[name]:Clone()
	m.Name = ("%s_%d"):format(name, i)
	m:SetAttribute("i", i)
	local x, z = it[2] / 10 * S, it[3] / 10 * S
	m:ScaleTo(it[5] / 100)
	m:PivotTo(CFrame.new(x, groundAt(x, z), z) * CFrame.Angles(0, math.rad(it[4]), 0))
	m.Parent = chunk
	if i % 150 == 0 then
		for _, c in ipairs(chunk:GetChildren()) do c.Parent = props end
		task.wait()
	end
end
for _, c in ipairs(chunk:GetChildren()) do c.Parent = props end

---------------------------------------------------------------- old colliders
-- Tree trunks (0.48 / 0.528 m square, pen 4) and boulders (pen 6, w:d 1.222,
-- h:w 0.545) were colliders; props carry their own now.
local dropped = 0
for _, p in ipairs(root.Colliders:GetDescendants()) do
	if p:IsA("BasePart") then
		local w, h, d = p.Size.X / S, p.Size.Y / S, p.Size.Z / S
		local pen = p:GetAttribute("pen")
		local trunk = pen == 4 and math.abs(w - d) < 0.005 and (math.abs(w - 0.48) < 0.005 or math.abs(w - 0.528) < 0.005)
		local boulder = pen == 6 and math.abs(w / d - 1.222) < 0.01 and math.abs(h / w - 0.545) < 0.01
		if trunk or boulder then p:Destroy(); dropped += 1 end
	end
end
return ("placed %d props in %d kinds; took %d old trunk/boulder colliders out"):format(#D.items, #D.kinds, dropped)
