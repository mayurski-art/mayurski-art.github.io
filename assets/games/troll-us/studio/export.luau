-- Troll Us exporter: the Studio build as JSON for the web (phase 4). Run in Edit through the Studio connection with
--   node assets/games/troll-us/tools/receive-export.mjs   running, then   loadstring(<this file>)()
-- It writes, through the receiver, into assets/games/troll-us/export/:
--   map.json       every instance under workspace.TrollUs.Map as a flat node list (folders, models, parts, lights, signs)
--   rig.json       StarterPlayer.StarterCharacter: parts, Motor6D joints and the trollface decal
--   hats.json      each hat from the Hats module, its parts placed relative to the dome
--   rules.json     the Rules module's data (functions are ported by hand) plus the suit colours
--   manifest.json  counts taken by a separate pass, for tools/check-export.mjs
-- Positions are studs; a frame is [x, y, z, qx, qy, qz, qw] (Roblox axes: +Y up, a part's front is -Z).
local HttpService = game:GetService("HttpService")
local RS = game:GetService("ReplicatedStorage")
local URL = "http://127.0.0.1:5291/export/"

local function r3(n) return math.floor(n * 1000 + 0.5) / 1000 end
local function vec(v) return { r3(v.X), r3(v.Y), r3(v.Z) } end
local function frame(cf)
	local axis, angle = cf:ToAxisAngle()
	local s = math.sin(angle / 2)
	local p = cf.Position
	return { r3(p.X), r3(p.Y), r3(p.Z), r3(axis.X * s), r3(axis.Y * s), r3(axis.Z * s), r3(math.cos(angle / 2)) }
end
local SHAPE = { Block = "box", Ball = "ball", Cylinder = "cyl", Wedge = "wedge", CornerWedge = "cornerwedge" }

-- attribute values as JSON: CFrames become frames, Vector3s arrays, Color3s hex
local function attrs(inst)
	local out, any = {}, false
	for k, v in pairs(inst:GetAttributes()) do
		local t = typeof(v)
		if t == "CFrame" then v = frame(v) elseif t == "Vector3" then v = vec(v) elseif t == "Color3" then v = "#" .. v:ToHex() end
		out[k] = v; any = true
	end
	return any and out or nil
end

local function partNode(p)
	local n = {
		shape = p:IsA("Part") and (SHAPE[p.Shape.Name] or "box") or (p:IsA("WedgePart") and "wedge" or "box"),
		size = vec(p.Size), cf = frame(p.CFrame), color = "#" .. p.Color:ToHex(), material = p.Material.Name,
	}
	if p.Transparency > 0 then n.transparency = r3(p.Transparency) end
	if p.Reflectance > 0 then n.reflectance = r3(p.Reflectance) end
	if p.CanCollide then n.collide = true end
	if not p.CastShadow then n.noShadow = true end
	return n
end

-- one pass over a tree: every instance becomes a node with its parent's index (nil = the root itself)
local function walk(root)
	local nodes, index = {}, {}
	local function add(inst, parentIdx)
		local n
		if inst:IsA("BasePart") then n = partNode(inst); n.kind = "part"
		elseif inst:IsA("Model") then n = { kind = "model" }
		elseif inst:IsA("Folder") then n = { kind = "folder" }
		elseif inst:IsA("PointLight") then
			n = { kind = "light", color = "#" .. inst.Color:ToHex(), brightness = r3(inst.Brightness), range = r3(inst.Range), enabled = inst.Enabled }
		elseif inst:IsA("SurfaceGui") then
			n = { kind = "sign", face = inst.Face.Name, ppsu = inst.PixelsPerStud, sizing = inst.SizingMode.Name }
		elseif inst:IsA("TextLabel") then
			n = { kind = "text", text = inst.Text, font = inst.Font.Name, color = "#" .. inst.TextColor3:ToHex(),
				bg = "#" .. inst.BackgroundColor3:ToHex(), bgTransparency = r3(inst.BackgroundTransparency), scaled = inst.TextScaled, textSize = inst.TextSize }
		elseif inst:IsA("Decal") then n = { kind = "decal", face = inst.Face.Name, texture = inst.Texture }
		else return end -- layout helpers (UIPadding) and the like do not cross over
		n.name = inst.Name
		n.parent = parentIdx
		n.attrs = attrs(inst)
		table.insert(nodes, n)
		index[inst] = #nodes - 1 -- 0-based for JavaScript
		for _, c in ipairs(inst:GetChildren()) do add(c, index[inst]) end
	end
	for _, c in ipairs(root:GetChildren()) do add(c, nil) end
	return nodes, index
end

local function post(name, data)
	local body = HttpService:JSONEncode(data)
	HttpService:PostAsync(URL .. name, body, Enum.HttpContentType.ApplicationJson)
	return #body
end

local was = HttpService.HttpEnabled
HttpService.HttpEnabled = true
local ok, err = pcall(function()
	local report = {}
	-- the map
	local Map = workspace.TrollUs.Map
	local mapNodes = walk(Map)
	table.insert(report, ("map.json %d nodes, %d KB"):format(#mapNodes, post("map.json", { version = 1, nodes = mapNodes }) // 1024))

	-- the rig: parts, joints and the face
	local rig = game.StarterPlayer:FindFirstChild("StarterCharacter")
	local rigNodes, rigIndex = walk(rig)
	local joints = {}
	for _, j in ipairs(rig:GetDescendants()) do
		if j:IsA("Motor6D") and j.Part0 and j.Part1 then
			table.insert(joints, { name = j.Name, part0 = rigIndex[j.Part0], part1 = rigIndex[j.Part1], c0 = frame(j.C0), c1 = frame(j.C1) })
		end
	end
	table.insert(report, ("rig.json %d nodes %d joints, %d KB"):format(#rigNodes, #joints,
		post("rig.json", { version = 1, nodes = rigNodes, joints = joints }) // 1024))

	-- hats: worn on a copy of the rig, each part stored relative to the dome
	local Hats = require(RS.TrollUs.Hats)
	local hats, hatParts = {}, 0
	for _, name in ipairs(Hats.LIST) do
		if name ~= "None" then
			local m = rig:Clone()
			Hats.wear(m, name)
			local dome, hat = m:FindFirstChild("Dome"), m:FindFirstChild("Hat")
			local parts = {}
			for _, p in ipairs(hat and hat:GetChildren() or {}) do
				if p:IsA("BasePart") then
					local n = partNode(p)
					n.cf = frame(dome.CFrame:ToObjectSpace(p.CFrame))
					n.attrs = attrs(p)
					table.insert(parts, n)
				end
			end
			hatParts += #parts
			table.insert(hats, { name = name, parts = parts })
			m:Destroy()
		end
	end
	table.insert(report, ("hats.json %d hats %d parts, %d KB"):format(#hats, hatParts,
		post("hats.json", { version = 1, list = Hats.LIST, hats = hats }) // 1024))

	-- rules: everything but the functions
	local Rules = require(RS.TrollUs.Rules)
	local function plain(v)
		if type(v) == "function" then return nil end
		if type(v) ~= "table" then return v end
		local out = {}
		for k, x in pairs(v) do local p = plain(x); if p ~= nil then out[k] = p end end
		return out
	end
	local rules = plain(Rules)
	-- suit colours live as Color3Values in ReplicatedStorage.TrollUsSuits, not in Rules
	rules.suitColors = {}
	for _, v in ipairs(RS.TrollUsSuits:GetChildren()) do
		if v:IsA("Color3Value") then rules.suitColors[v.Name] = "#" .. v.Value:ToHex() end
	end
	table.insert(report, ("rules.json %d KB"):format(post("rules.json", rules) // 1024))

	-- manifest: counted the plain way, so a node lost in the walk shows up
	local counts = { mapParts = 0, mapModels = 0, mapLights = 0, mapSigns = 0, rigParts = 0, rigJoints = 0, hats = #Hats.LIST - 1, folders = {} }
	for _, d in ipairs(Map:GetDescendants()) do
		if d:IsA("BasePart") then counts.mapParts += 1
		elseif d:IsA("Model") then counts.mapModels += 1
		elseif d:IsA("PointLight") then counts.mapLights += 1
		elseif d:IsA("SurfaceGui") then counts.mapSigns += 1 end
	end
	for _, f in ipairs(Map:GetChildren()) do
		local n = 0
		for _, d in ipairs(f:GetDescendants()) do if d:IsA("BasePart") then n += 1 end end
		if f:IsA("BasePart") then n += 1 end
		counts.folders[f.Name] = n
	end
	for _, d in ipairs(rig:GetDescendants()) do
		if d:IsA("BasePart") then counts.rigParts += 1 elseif d:IsA("Motor6D") then counts.rigJoints += 1 end
	end
	post("manifest.json", { version = 1, counts = counts })
	table.insert(report, "manifest.json sent")
	return table.concat(report, "\n")
end)
HttpService.HttpEnabled = was
if not ok then error(err) end
return err -- the report
