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

local HS = HttpService.HttpEnabled
HttpService.HttpEnabled = true
local ok, res = pcall(function()
	return HttpService:PostAsync(("http://localhost:%d/colliders"):format(PORT), HttpService:JSONEncode(out), Enum.HttpContentType.ApplicationJson)
end)
HttpService.HttpEnabled = HS
if not ok then error("post: " .. tostring(res)) end
return ("sent %d colliders: %s"):format(#out, res)
