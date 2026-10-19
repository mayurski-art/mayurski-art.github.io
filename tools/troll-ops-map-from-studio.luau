--!nocheck
-- Troll City back out of Studio (doc "Troll City redesign in Roblox
-- Studio"). Run in the place's Edit datamodel over the Studio MCP while
-- tools/troll-ops-map-from-studio.mjs listens (port 5297 unless PORT is
-- set). Sends where everything in workspace.TrollCity_Live stands now:
--   parts      each Part with its piece number P (moved, turned or resized
--              as you like), each MeshPart with its mesh number TC_Mesh,
--              and any new Part you made (its shape, colour and material)
--   colliders  every part in a Colliders folder, as the game's AABB (a
--              turned part gives its world box), with its number C if it
--              came from the game
--   markers    every part with a marker number M, where it stands and faces
-- Anything with Live set is the game's code's and is left out. The whole
-- town moved or turned as one (a stray drag) means nothing to the game:
-- everything is sent relative to the town's Home pivot.
--
-- A module: the to-studio import keeps it in the place as
-- ServerStorage.TC_FromStudio, so a round trip is
--   require(game.ServerStorage.TC_FromStudio:Clone())(5297)
return function(PORT)
	PORT = PORT or 5297
	local HttpService = game:GetService("HttpService")
	local root = workspace:FindFirstChild("TrollCity_Live")
	if not root then error("no workspace.TrollCity_Live: import it with tools/troll-ops-map-to-studio.luau first") end
	local K = 3
	local U = (root:GetAttribute("Home") or root:GetPivot()) * root:GetPivot():Inverse()

	local function cfOut(cf)
		local c = { cf:GetComponents() }   -- x y z, then the rotation's rows
		for i = 1, 12 do c[i] = math.floor(c[i] * 1e5 + 0.5) / 1e5 end
		return c
	end
	local function sz(v) return { v.X, v.Y, v.Z } end
	local function inFolder(p, name)
		local q = p.Parent
		while q and q ~= root do
			if q:IsA("Folder") and q.Name == name then return true end
			q = q.Parent
		end
		return false
	end
	local function modelPath(p)
		local t = {}
		local q = p.Parent
		while q and q ~= root do
			if q:IsA("Model") then table.insert(t, 1, q.Name) end
			q = q.Parent
		end
		return table.concat(t, "/")
	end

	local parts, cols, marks = {}, {}, {}
	local n = 0
	for _, p in ipairs(root:GetDescendants()) do
		if p:IsA("BasePart") and not p:GetAttribute("Live") then
			if p:GetAttribute("M") then
				local lift = p:GetAttribute("Lift") or 0
				local pcf = U * p.CFrame
				local pos = pcf.Position - Vector3.new(0, lift, 0)
				local look = pcf.LookVector
				table.insert(marks, { m = p:GetAttribute("M"), p = { pos.X / K, pos.Y / K, pos.Z / K },
					-- the way it faces, in the game's yaw (0 = -z, +PI/2 = -x)
					yaw = math.atan2(-look.X, -look.Z), size = p:GetAttribute("Kind") == "rp" and p.Shape == Enum.PartType.Block and sz(p.Size / K) or nil })
			elseif inFolder(p, "Colliders") then
				local cf, half = U * p.CFrame, p.Size / 2
				local ex = math.abs(cf.RightVector.X) * half.X + math.abs(cf.UpVector.X) * half.Y + math.abs(cf.LookVector.X) * half.Z
				local ey = math.abs(cf.RightVector.Y) * half.X + math.abs(cf.UpVector.Y) * half.Y + math.abs(cf.LookVector.Y) * half.Z
				local ez = math.abs(cf.RightVector.Z) * half.X + math.abs(cf.UpVector.Z) * half.Y + math.abs(cf.LookVector.Z) * half.Z
				local c = cf.Position
				table.insert(cols, { c = p:GetAttribute("C"), x = c.X / K, z = c.Z / K, w = 2 * ex / K, d = 2 * ez / K, h = 2 * ey / K,
					y = (c.Y - ey) / K, pen = p:GetAttribute("Pen") or 0.9 })
			elseif p:GetAttribute("TC_Mesh") then
				table.insert(parts, { g = p:GetAttribute("TC_Mesh"), cf = cfOut(U * p.CFrame), s = sz(p.Size), s0 = sz(p:GetAttribute("Size0") or p.Size) })
			elseif p:GetAttribute("P") then
				table.insert(parts, { p = p:GetAttribute("P"), cf = cfOut(U * p.CFrame), s = sz(p.Size) })
			elseif not inFolder(p, "Lights") and not inFolder(p, "Markers") then
				-- new: made in Studio
				table.insert(parts, { new = p:IsA("Part") and p.Shape.Name or p.ClassName, cf = cfOut(U * p.CFrame), s = sz(p.Size),
					color = { p.Color.R, p.Color.G, p.Color.B }, mat = p.Material.Name, alpha = 1 - p.Transparency, name = p.Name, path = modelPath(p) })
			end
		end
		n += 1
		if n % 2000 == 0 then task.wait() end
	end

	local HS = HttpService.HttpEnabled
	HttpService.HttpEnabled = true
	local ok, res = pcall(function()
		local post = function(what, body)
			return HttpService:PostAsync(("http://127.0.0.1:%d/%s"):format(PORT, what), HttpService:JSONEncode(body), Enum.HttpContentType.ApplicationJson)
		end
		local CHUNK = 2500
		for i = 1, #parts, CHUNK do
			post("parts", table.move(parts, i, math.min(#parts, i + CHUNK - 1), 1, {}))
			task.wait()
		end
		post("colliders", cols)
		post("markers", marks)
		return post("end", { parts = #parts, colliders = #cols, markers = #marks })
	end)
	HttpService.HttpEnabled = HS
	if not ok then error("post: " .. tostring(res)) end
	return ("sent %d parts, %d colliders, %d markers: %s"):format(#parts, #cols, #marks, res)
end
