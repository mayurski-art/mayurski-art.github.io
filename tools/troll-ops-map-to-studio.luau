-- Pull a Troll Forces map from tools/troll-ops-map-to-studio.mjs (run it
-- first) and build it in Studio. Run in Edit mode, as a ModuleScript that
-- returns this function (GET it from the exporter's server and require it):
--
--   workspace.<Map>_Live            the town, one Model a building or prop:
--     <Section>/<Thing>_<n>/...      Parts (saved with the place) and
--                                    MeshParts (Mesh_<i>, made from code)
--       Colliders                    its collision boxes (hidden, solid,
--                                    locked): they move with the model
--       Markers                      its RP spots (locked): the same
--       Lights                       its lamps (drawn by code: reference)
--     Markers                        spawns and zombie windows (locked)
--   A Part or MeshPart with Live set is drawn by code in the game (the
--   train, the board, the jail doors): locked, shown for reference only.
--   ServerStorage.TC_MeshData_<map>/<i>  each mesh's data, and TC_Images_<map>/<i>
--                                    (a place can hold several maps: Kabukigrin's
--                                    holds Grinjuku and a Trolling Loud library)
--   ServerStorage.TC_Lib             require(it).restore(): rebuilds every
--                                    Mesh_<i> after the place is reopened
--                                    (code-made meshes aren't saved), where
--                                    it stands now
--   Every part carries Map = the map it came from, so a piece dragged from
--   one map's root into another's exports from the right capture.
-- 1 m = 3 studs, same axes as the game (y up, -z north).
return function(opts)
	opts = opts or {}
	local PORT = opts.port or 5299
	local K = 3
	local HttpService = game:GetService("HttpService")
	local ServerStorage = game:GetService("ServerStorage")
	local base = "http://127.0.0.1:" .. PORT
	local status = { phase = "start", done = false }
	_G.TC_Import = status

	local LIB_SRC = [==[
local AssetService = game:GetService("AssetService")
local HttpService = game:GetService("HttpService")
local ServerStorage = game:GetService("ServerStorage")
local K = 3
local M = {}
local function MATERIAL(n)
	local ok, m = pcall(function() return Enum.Material[n] end)
	return ok and m or Enum.Material.SmoothPlastic
end
M.material = MATERIAL
-- a map's data folder (an older place, one map, has no suffix)
local function dataName(base, map) return map and (base .. "_" .. map) or base end
M.dataName = dataName
local B64 = {}
do
	local alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
	for i = 1, 64 do B64[string.byte(alphabet, i)] = i - 1 end
end
local function joined(folder)
	local t = {}
	for i = 1, #folder:GetChildren() do t[i] = folder:FindFirstChild(tostring(i)).Value end
	return table.concat(t)
end
local images = {}
function M.image(i, map)
	local key = tostring(map) .. "/" .. i
	if images[key] then return images[key] end
	local folder = ServerStorage:FindFirstChild(dataName("TC_Images", map))
	local f = folder and folder:FindFirstChild(tostring(i))
	if not f then return nil end
	local s, w, h = joined(f), f:GetAttribute("w"), f:GetAttribute("h")
	local size = w * h * 4
	local buf = buffer.create(size)
	local o = 0
	for p = 1, #s, 4 do
		local a, b = B64[string.byte(s, p)], B64[string.byte(s, p + 1)]
		local c, d = B64[string.byte(s, p + 2) or 61], B64[string.byte(s, p + 3) or 61]
		local v = bit32.lshift(a, 18) + bit32.lshift(b, 12) + bit32.lshift(c or 0, 6) + (d or 0)
		if o < size then buffer.writeu8(buf, o, bit32.rshift(v, 16)) end
		if c and o + 1 < size then buffer.writeu8(buf, o + 1, bit32.band(bit32.rshift(v, 8), 255)) end
		if d and o + 2 < size then buffer.writeu8(buf, o + 2, bit32.band(v, 255)) end
		o += 3
		if p % 400000 == 1 then task.wait() end
	end
	local img = AssetService:CreateEditableImage({ Size = Vector2.new(w, h) })
	img:WritePixelsBuffer(Vector2.zero, Vector2.new(w, h), buf)
	images[key] = { img = img, flipY = f:GetAttribute("flipY") }
	return images[key]
end
-- a MeshPart from mesh i's data, centred on its own box (its centre in the map, in studs, comes back too)
function M.mesh(i, mats, map)
	local f = ServerStorage[dataName("TC_MeshData", map)]:FindFirstChild(tostring(i))
	local m = HttpService:JSONDecode(joined(f))
	local mat = mats[m.mat + 1]
	local nv = #m.v / 3
	local lo, hi = Vector3.one * math.huge, -Vector3.one * math.huge
	for v = 0, nv - 1 do
		local p = Vector3.new(m.v[v*3+1], m.v[v*3+2], m.v[v*3+3]) * K
		lo = lo:Min(p); hi = hi:Max(p)
	end
	local mid = (lo + hi) / 2
	local tex = mat.img >= 0 and M.image(mat.img, map) or nil
	local em = AssetService:CreateEditableMesh()
	local vid, nid, uid = {}, {}, {}
	for v = 0, nv - 1 do
		vid[v] = em:AddVertex(Vector3.new(m.v[v*3+1], m.v[v*3+2], m.v[v*3+3]) * K - mid)
		nid[v] = em:AddNormal(Vector3.new(m.n[v*3+1], m.n[v*3+2], m.n[v*3+3]))
		local u, w = m.uv[v*2+1], m.uv[v*2+2]
		if not tex or tex.flipY then w = 1 - w end   -- three's UVs run bottom-up
		uid[v] = em:AddUV(Vector2.new(u, w))
	end
	for t = 0, #m.tri / 3 - 1 do
		local a, b, c = m.tri[t*3+1], m.tri[t*3+2], m.tri[t*3+3]
		local fc = em:AddTriangle(vid[a], vid[b], vid[c])
		em:SetFaceNormals(fc, { nid[a], nid[b], nid[c] })
		em:SetFaceUVs(fc, { uid[a], uid[b], uid[c] })
		if t % 4000 == 3999 then task.wait() end
	end
	local mp = AssetService:CreateMeshPartAsync(Content.fromObject(em))
	mp.Name = "Mesh_" .. i
	mp.Anchored = true; mp.CanCollide = false
	mp.Material = MATERIAL(mat.rbx)
	if tex then
		mp.TextureContent = Content.fromObject(tex.img)
		mp.Color = Color3.new(1, 1, 1)
		mp.Material = Enum.Material.SmoothPlastic
	else
		mp.Color = Color3.new(mat.color[1], mat.color[2], mat.color[3])
	end
	if mat.alpha < 1 then mp.Transparency = 1 - mat.alpha end
	mp.DoubleSided = mat.both or mat.cutout or false
	mp:SetAttribute("TC_Mesh", i)
	-- its size at scale 1: resizing it in Studio scales the piece in the game
	mp:SetAttribute("Size0", mp.Size)
	mp:SetAttribute("TC_Mat", mat.name)
	if map then mp:SetAttribute("Map", map) end
	mp.CFrame = CFrame.new(mid)
	return mp, mid
end
function M.mats(map)
	return HttpService:JSONDecode(ServerStorage[dataName("TC_MeshData", map)]:GetAttribute("mats"))
end
-- After reopening the place: every Mesh_<i> is an empty MeshPart. Make
-- each again where it stands now, the size it is now.
function M.restore()
	local mats = {}
	local n = 0
	for _, old in ipairs(workspace:GetDescendants()) do
		if old:IsA("MeshPart") and old:GetAttribute("TC_Mesh") then
			local map = old:GetAttribute("Map")
			local mk = tostring(map)
			if not mats[mk] then mats[mk] = M.mats(map) end
			local mp = M.mesh(old:GetAttribute("TC_Mesh"), mats[mk], map)
			mp.CFrame = old.CFrame
			mp.Size = old.Size
			mp.Name = old.Name
			for k, v in pairs(old:GetAttributes()) do mp:SetAttribute(k, v) end
			mp.Parent = old.Parent
			old:Destroy()
			n += 1
			task.wait()
		end
	end
	return n
end
return M
]==]

	local function get(p)
		local r = HttpService:RequestAsync({ Url = base .. p, Method = "GET" })
		if not r.Success then error(p .. ": " .. r.StatusCode) end
		return r.Body
	end
	local function getBig(p)
		local chunks, from, SLICE = {}, 0, 1500000
		while true do
			local s = get(p .. "?from=" .. from .. "&len=" .. SLICE)
			table.insert(chunks, s)
			if #s < SLICE then break end
			from += SLICE
		end
		return table.concat(chunks)
	end
	-- a long string into numbered StringValues (one Value stays small)
	local function store(folder, name, s, attrs)
		local f = Instance.new("Folder"); f.Name = name
		local n, SLICE = 0, 150000
		for from = 1, #s, SLICE do
			n += 1
			local v = Instance.new("StringValue"); v.Name = tostring(n); v.Value = string.sub(s, from, from + SLICE - 1); v.Parent = f
		end
		for k, v in pairs(attrs or {}) do f:SetAttribute(k, v) end
		f.Parent = folder
	end

	local wasHttp = HttpService.HttpEnabled
	HttpService.HttpEnabled = true
	local ok, err = pcall(function()
		local index = HttpService:JSONDecode(get("/x/index.json"))
		local mats = index.mats
		local MAP = index.map
		local rootName = (index.root or index.name or index.map):gsub("%s+", "") .. "_Live"

		-- never lose someone's edits: an earlier import is kept, renamed
		local prev = workspace:FindFirstChild(rootName)
		if prev then prev.Name = rootName .. "_old_" .. os.time() end
		local root = Instance.new("Model"); root.Name = rootName
		root:SetAttribute("TC_Map", MAP)
		root:SetAttribute("TC_Unit", "1 m = 3 studs")

		-- the library + this map's stored data (another map's stays)
		local meshName, imgName = "TC_MeshData_" .. MAP, "TC_Images_" .. MAP
		for _, n in ipairs({ "TC_Lib", meshName, imgName }) do
			local o = ServerStorage:FindFirstChild(n); if o then o:Destroy() end
		end
		local lib = Instance.new("ModuleScript"); lib.Name = "TC_Lib"; lib.Source = LIB_SRC; lib.Parent = ServerStorage
		local meshData = Instance.new("Folder"); meshData.Name = meshName; meshData.Parent = ServerStorage
		meshData:SetAttribute("mats", HttpService:JSONEncode(mats))
		local imgData = Instance.new("Folder"); imgData.Name = imgName; imgData.Parent = ServerStorage
		local Lib = require(lib:Clone())
		-- every part knows the map it came from
		local function tag(part) part:SetAttribute("Map", MAP) end

		-- the models, nested by path; built off the DataModel, parented a section at a time
		local models = {}
		local sections = {}
		local function modelAt(path)
			if models[path] then return models[path] end
			local parentPath, name = path:match("^(.*)/([^/]+)$")
			local parent
			if parentPath then parent = modelAt(parentPath) else parent = nil; name = path end
			local m = Instance.new("Model"); m.Name = name
			m:SetAttribute("TC_Path", path)
			if parent then m.Parent = parent else sections[path] = m end
			models[path] = m
			return m
		end

		-- a model's own folder (Colliders, Markers, Lights), made on first use
		local function folderIn(path, name)
			local m = path and modelAt(path) or root
			local f = m:FindFirstChild(name)
			if not f then f = Instance.new("Folder"); f.Name = name; f.Parent = m end
			return f
		end
		-- a live piece is drawn by code in the game (the train, the board, the
		-- jail doors): shown here for reference, locked, and never exported
		local function liveOne(part)
			part.Locked = true
			part:SetAttribute("Live", true)
		end

		status.phase = "parts"
		local MATERIAL = Lib.material
		local SHAPE = { b = Enum.PartType.Block, c = Enum.PartType.Cylinder, s = Enum.PartType.Ball }
		local made = 0
		for c = 0, index.partChunks - 1 do
			local list = HttpService:JSONDecode(getBig("/x/parts-" .. c .. ".json"))
			for _, p in ipairs(list) do
				local mat = mats[p.m + 1]
				local part = Instance.new("Part")
				part.Shape = SHAPE[p.k]
				part.Anchored = true; part.CanCollide = false
				part.Size = Vector3.new(p.s[1], p.s[2], p.s[3]) * K
				local f = p.f
				part.CFrame = CFrame.fromMatrix(Vector3.new(p.p[1], p.p[2], p.p[3]) * K,
					Vector3.new(f[1], f[2], f[3]), Vector3.new(f[4], f[5], f[6]), Vector3.new(f[7], f[8], f[9]))
				part.Color = Color3.new(mat.color[1], mat.color[2], mat.color[3])
				part.Material = MATERIAL(mat.rbx)
				if mat.alpha < 1 then part.Transparency = 1 - mat.alpha end
				part.TopSurface = Enum.SurfaceType.Smooth; part.BottomSurface = Enum.SurfaceType.Smooth
				part.Name = p.name or mat.name
				-- the game piece it is (the from-studio tool rebuilds it from the code's own geometry)
				if p.i then part:SetAttribute("P", p.i) end
				if p.live then liveOne(part) end
				tag(part)
				part.Parent = modelAt(p.path)
				made += 1
			end
			status.parts = made
			task.wait()
		end

		status.phase = "images"
		for _, im in ipairs(index.images) do
			store(imgData, tostring(im.i), getBig("/x/img-" .. im.i .. ".b64"), { w = im.w, h = im.h, flipY = im.flipY })
			task.wait()
		end

		status.phase = "meshes"
		local nm = 0
		for _, info in ipairs(index.meshes) do
			store(meshData, tostring(info.i), getBig("/x/mesh-" .. info.i .. ".json"))
			-- one that Studio can't take (the far plain is 2700 studs across) is skipped and named
			local okMesh, mp = pcall(Lib.mesh, info.i, mats, MAP)
			if okMesh then
				if info.live then liveOne(mp) end
				tag(mp)
				mp.Parent = modelAt(info.path); nm += 1
			else status.skipped = (status.skipped or "") .. info.path .. " (" .. tostring(mp) .. "); " end
			status.meshes = nm
			task.wait()
		end

		status.phase = "colliders"
		-- each in the model it belongs to (it moves with it); the live ones
		-- (the train's, the jail doors') stay code's and aren't shown
		local cols = HttpService:JSONDecode(getBig("/x/colliders.json"))
		local shown = 0
		for _, c in ipairs(cols) do
			if not c.live then
				local lo = Vector3.new(c.min[1], c.min[2], c.min[3]) * K
				local hi = Vector3.new(c.max[1], c.max[2], c.max[3]) * K
				local part = Instance.new("Part"); part.Name = "Collider_" .. c.i
				part.Anchored = true; part.CanCollide = true; part.Locked = true; part.CastShadow = false
				part.Transparency = 1; part.Color = Color3.fromRGB(255, 60, 60); part.Material = Enum.Material.ForceField
				part.Size = (hi - lo):Max(Vector3.one * 0.05); part.CFrame = CFrame.new((lo + hi) / 2)
				part:SetAttribute("C", c.i)
				part:SetAttribute("Pen", c.pen)
				tag(part)
				part.Parent = folderIn(c.path, "Colliders")
				shown += 1
			end
		end

		local KIND = { spawn = Color3.fromRGB(0, 170, 255), zombie = Color3.fromRGB(120, 200, 60), rp = Color3.fromRGB(255, 170, 0),
			site = Color3.fromRGB(255, 50, 50), rope = Color3.fromRGB(190, 90, 255), stair = Color3.fromRGB(60, 220, 200) }
		for _, mk in ipairs(index.markers) do
			local part = Instance.new("Part"); part.Name = mk.name
			part.Anchored = true; part.CanCollide = false; part.Locked = true; part.CastShadow = false
			part.Material = Enum.Material.Neon; part.Color = KIND[mk.kind] or Color3.new(1, 1, 1)
			local lift
			if mk.zone then
				-- a zone: a flat sheet over the floor it covers
				part.Size = Vector3.new(mk.zone[1] * K, 0.1, mk.zone[2] * K); part.Transparency = 0.85
				lift = 0.05
			elseif mk.kind == "rope" then
				-- a rope: a thin post from its foot to its top
				local h = (mk.top - mk.p[2]) * K
				part.Size = Vector3.new(0.3, h, 0.3); part.Transparency = 0.4
				lift = h / 2
			else
				part.Shape = Enum.PartType.Ball; part.Size = Vector3.one * (mk.kind == "rp" and 0.6 or 1.5)
				lift = part.Size.Y / 2
			end
			local pos = Vector3.new(mk.p[1], mk.p[2], mk.p[3]) * K + Vector3.new(0, lift, 0)
			part.CFrame = mk.yaw and CFrame.new(pos) * CFrame.Angles(0, mk.yaw, 0) or CFrame.new(pos)
			part:SetAttribute("M", mk.i)
			part:SetAttribute("Lift", lift)
			part:SetAttribute("Kind", mk.kind)
			if mk.label then part:SetAttribute("Label", mk.label) end
			if mk.team then part:SetAttribute("Team", mk.team) end
			if mk.yaw then part:SetAttribute("Yaw", mk.yaw) end
			if mk.top then part:SetAttribute("Top", mk.top) end
			if mk.dir then part:SetAttribute("Dir", mk.dir) end
			if mk.to then part:SetAttribute("To", Vector3.new(mk.to[1], mk.to[2], mk.to[3])) end
			tag(part)
			part.Parent = folderIn(mk.path, "Markers")
		end

		-- the map's real lights: the game makes them in code, from here on
		-- where these stand (a new map reads them back; Troll City's are its own)
		for i, l in ipairs(index.lights) do
			local part = Instance.new("Part"); part.Name = "Lamp_" .. i
			part.Anchored = true; part.CanCollide = false; part.Transparency = 0.7; part.CastShadow = false
			part.Material = Enum.Material.Neon; part.Color = Color3.new(l.color[1], l.color[2], l.color[3])
			part.Shape = Enum.PartType.Ball
			part.Size = Vector3.one * 0.6; part.CFrame = CFrame.new(Vector3.new(l.p[1], l.p[2], l.p[3]) * K)
			part:SetAttribute("Kind", "light")
			part:SetAttribute("Power", l.power)
			part:SetAttribute("Range", l.range)
			local pl = Instance.new("PointLight")
			pl.Color = Color3.new(l.color[1], l.color[2], l.color[3])
			pl.Brightness = math.clamp(l.power / 6, 0.5, 4)
			pl.Range = math.min(60, l.range * K)
			pl.Shadows = true
			pl.Parent = part
			tag(part)
			part.Parent = folderIn(l.path, "Lights")
		end

		-- section by section into the workspace
		status.phase = "parenting"
		root.Parent = workspace
		for _, m in pairs(sections) do m.Parent = root; task.wait() end
		-- where the town stands: a stray drag of the whole town is undone on the way out
		-- the pivot pinned at the game's origin: Home is then where the game stands
		root.WorldPivot = CFrame.identity
		root:SetAttribute("Home", root:GetPivot())
		-- a library stands aside; its pieces export relative to Home all the same
		if index.at then root:PivotTo(root:GetPivot() + Vector3.new(index.at[1], index.at[2], index.at[3]) * K) end
		-- the way back (tools/troll-ops-map-from-studio.luau), kept in the place
		local back = ServerStorage:FindFirstChild("TC_FromStudio"); if back then back:Destroy() end
		back = Instance.new("ModuleScript"); back.Name = "TC_FromStudio"
		back.Source = get("/tools/troll-ops-map-from-studio.luau"); back.Parent = ServerStorage
		cols = { n = shown }
		status.colliders = cols.n
		status.markers = #index.markers
	end)
	HttpService.HttpEnabled = wasHttp
	status.done = true
	status.ok = ok
	status.err = (not ok) and tostring(err) or nil
	pcall(function() HttpService.HttpEnabled = true; get("/done"); HttpService.HttpEnabled = wasHttp end)
	return status
end
