-- Pull a TROLLS NFT character from tools/troll-ops-to-studio.mjs (run it first)
-- and build it in Studio from its traits. Run in the command bar or through
-- the Studio MCP, in Edit mode.
--
--   ServerStorage.TF_Traits/<type>/<name>   one Model per trait: clothes, hat,
--     facial, eyes, and base (the troll's own bare head). Every piece carries
--     Joint (the game joint it rides) and Offset (its CFrame off that joint),
--     so it fits any character built here: a new NFT with the same hair just
--     wears the same hat model.
--   ServerStorage.TF_Wear                    wear(character, traitModel) /
--     unwear(character, type) / build(name, joints, origin) for a bare skeleton.
--   workspace.TF_<token>                     the skeleton (joint parts named
--     like the game's rig.parts on Motor6Ds: the TF_Rig clips play on it)
--     wearing its traits.
--   workspace.TF_TraitShelf                  each trait on its own, labelled.
--
-- The meshes are made from code (EditableMesh): they live only in this Studio
-- session, so run both again after reopening the place.
local PORT = 5298
local K = 4                         -- studs per metre (TF_Rig's)
local ORIGIN = Vector3.new(12, 0, 0)
local SHELF = Vector3.new(-14, 0, 14)

local HttpService = game:GetService("HttpService")
local AssetService = game:GetService("AssetService")
local ServerStorage = game:GetService("ServerStorage")
local base = "http://127.0.0.1:" .. PORT

local WEAR_SRC = [==[
-- TF_Wear: put TROLLS traits (ServerStorage.TF_Traits) on TF characters.
local M = {}
function M.unwear(char, kind)
	local old = char:FindFirstChild("Trait_" .. kind)
	if old then old:Destroy() end
end
function M.wear(char, trait)
	local kind = trait:GetAttribute("Type")
	M.unwear(char, kind)
	local holder = Instance.new("Model")
	holder.Name = "Trait_" .. kind
	holder:SetAttribute("Type", kind)
	holder:SetAttribute("TraitName", trait.Name)
	for _, p in ipairs(trait:GetChildren()) do
		if p:IsA("BasePart") then
			local joint = char:FindFirstChild(p:GetAttribute("Joint")) or char.PrimaryPart
			local c = p:Clone()
			c.Anchored = false; c.CanCollide = false; c.Massless = true
			c.CFrame = joint.CFrame * p:GetAttribute("Offset")
			c.Parent = holder
			local w = Instance.new("WeldConstraint"); w.Part0 = joint; w.Part1 = c; w.Parent = c
		end
	end
	holder.Parent = char
	return holder
end
-- A bare skeleton: joints = { {name, parent, p = {x,y,z} (metres), q = {x,y,z,w}} }
function M.build(name, joints, origin, K)
	K = K or 4
	local old = workspace:FindFirstChild(name); if old then old:Destroy() end
	local model = Instance.new("Model"); model.Name = name
	local root = Instance.new("Part")
	root.Name = "HumanoidRootPart"; root.Size = Vector3.one * 0.4 * K; root.Transparency = 1
	root.Anchored = true; root.CanCollide = false; root.CFrame = CFrame.new(origin); root.Parent = model
	model.PrimaryPart = root
	local parts = { root = root }
	local pending = joints
	while #pending > 0 do
		local rest = {}
		for _, j in ipairs(pending) do
			local p0 = parts[j.parent]
			if p0 then
				local c0 = CFrame.new(j.p[1] * K, j.p[2] * K, j.p[3] * K, j.q[1], j.q[2], j.q[3], j.q[4])
				local p = Instance.new("Part")
				p.Name = j.name; p.Size = Vector3.one * 0.05 * K; p.Transparency = 1
				p.CanCollide = false; p.Massless = true; p.CFrame = p0.CFrame * c0; p.Parent = model
				local m = Instance.new("Motor6D"); m.Name = j.name; m.Part0 = p0; m.Part1 = p; m.C0 = c0
				m:SetAttribute("BaseC0", c0); m.Parent = p0
				parts[j.name] = p
			else
				table.insert(rest, j)
			end
		end
		assert(#rest < #pending, "joint tree has a missing parent")
		pending = rest
	end
	local ac = Instance.new("AnimationController"); ac.Parent = model
	Instance.new("Animator").Parent = ac
	model.Parent = workspace
	return model
end
return M
]==]

local was = HttpService.HttpEnabled
HttpService.HttpEnabled = true
local function get(path) return HttpService:GetAsync(base .. path, true) end
local ok, res = pcall(function()
	local index = HttpService:JSONDecode(get("/index.json"))
	local function srgb(c) return c <= 0.0031308 and c * 12.92 or 1.055 * c ^ (1 / 2.4) - 0.055 end

	-- the wear module, fresh
	local old = ServerStorage:FindFirstChild("TF_Wear"); if old then old:Destroy() end
	local wearMod = Instance.new("ModuleScript"); wearMod.Name = "TF_Wear"; wearMod.Source = WEAR_SRC; wearMod.Parent = ServerStorage
	local Wear = require(wearMod:Clone())

	-- textures (raw RGBA, base64, a slice at a time)
	local B64 = {}
	local alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
	for i = 1, 64 do B64[string.byte(alphabet, i)] = i - 1 end
	local images = {}
	for _, t in ipairs(index.textures) do
		local chunks, from, SLICE = {}, 0, 1500000
		while from < t.chars do table.insert(chunks, get("/tex/" .. t.i .. ".b64?from=" .. from .. "&len=" .. SLICE)); from += SLICE end
		local s = table.concat(chunks)
		local size = t.w * t.h * 4
		local buf = buffer.create(size)
		local o = 0
		for i = 1, #s, 4 do
			local a, b = B64[string.byte(s, i)], B64[string.byte(s, i + 1)]
			local c, d = B64[string.byte(s, i + 2) or 61], B64[string.byte(s, i + 3) or 61]
			local v = bit32.lshift(a, 18) + bit32.lshift(b, 12) + bit32.lshift(c or 0, 6) + (d or 0)
			if o < size then buffer.writeu8(buf, o, bit32.rshift(v, 16)) end
			if c and o + 1 < size then buffer.writeu8(buf, o + 1, bit32.band(bit32.rshift(v, 8), 255)) end
			if d and o + 2 < size then buffer.writeu8(buf, o + 2, bit32.band(v, 255)) end
			o += 3
			if i % 400000 == 1 then task.wait() end
		end
		local img = AssetService:CreateEditableImage({ Size = Vector2.new(t.w, t.h) })
		img:WritePixelsBuffer(Vector2.zero, Vector2.new(t.w, t.h), buf)
		images[t.i] = { img = img, flipY = t.flipY }
		task.wait()
	end

	-- the trait library: one Model per trait, rebuilt from this token
	local lib = ServerStorage:FindFirstChild("TF_Traits") or Instance.new("Folder")
	lib.Name = "TF_Traits"; lib.Parent = ServerStorage
	local traitName = function(kind)
		if kind == "base" then return "Troll" end
		return index.traits[kind] or kind
	end
	local models = {}
	local function traitModel(kind)
		if models[kind] then return models[kind] end
		local folder = lib:FindFirstChild(kind) or Instance.new("Folder")
		folder.Name = kind; folder.Parent = lib
		local name = traitName(kind)
		local prev = folder:FindFirstChild(name); if prev then prev:Destroy() end
		local m = Instance.new("Model"); m.Name = name
		m:SetAttribute("Type", kind)
		m:SetAttribute("FromToken", index.token)
		m.Parent = folder
		models[kind] = m
		return m
	end

	local made = 0
	for _, info in ipairs(index.meshes) do
		local m = HttpService:JSONDecode(get("/mesh/" .. info.i .. ".json"))
		local nv = #m.v / 3
		local lo, hi = Vector3.one * math.huge, -Vector3.one * math.huge
		for i = 0, nv - 1 do
			local p = Vector3.new(m.v[i*3+1], m.v[i*3+2], m.v[i*3+3]) * K
			lo = lo:Min(p); hi = hi:Max(p)
		end
		-- a MeshPart sits on its mesh's centre: centre the piece on its own box
		local mid = (lo + hi) / 2
		local em = AssetService:CreateEditableMesh()
		local vid, nid, uid, cid = {}, {}, {}, {}
		local tex = m.tex >= 0 and images[m.tex] or nil
		for i = 0, nv - 1 do
			vid[i] = em:AddVertex(Vector3.new(m.v[i*3+1], m.v[i*3+2], m.v[i*3+3]) * K - mid)
			if m.n then nid[i] = em:AddNormal(Vector3.new(m.n[i*3+1], m.n[i*3+2], m.n[i*3+3])) end
			if m.uv then
				local u, v = m.uv[i*2+1], m.uv[i*2+2]
				if not tex or tex.flipY then v = 1 - v end   -- three's image UVs run bottom-up; glTF's and Roblox's top-down
				uid[i] = em:AddUV(Vector2.new(u, v))
			end
			if m.col then cid[i] = em:AddColor(Color3.new(srgb(m.col[i*3+1]), srgb(m.col[i*3+2]), srgb(m.col[i*3+3])), 1) end
		end
		for t = 0, #m.tri / 3 - 1 do
			local a, b, c = m.tri[t*3+1], m.tri[t*3+2], m.tri[t*3+3]
			local f = em:AddTriangle(vid[a], vid[b], vid[c])
			if m.n then em:SetFaceNormals(f, { nid[a], nid[b], nid[c] }) end
			if m.uv then em:SetFaceUVs(f, { uid[a], uid[b], uid[c] }) end
			if m.col then em:SetFaceColors(f, { cid[a], cid[b], cid[c] }) end
			if t % 4000 == 3999 then task.wait() end
		end
		local mp = AssetService:CreateMeshPartAsync(Content.fromObject(em))
		mp.Name = m.joint .. "_" .. m.name
		mp.Anchored = true; mp.CanCollide = false; mp.Massless = true
		mp.Material = Enum.Material.SmoothPlastic
		if tex then
			mp.TextureContent = Content.fromObject(tex.img)
			mp.Color = Color3.new(1, 1, 1)
		else
			mp.Color = Color3.new(srgb(m.color[1]), srgb(m.color[2]), srgb(m.color[3]))
		end
		if m.opacity and m.opacity < 1 then mp.Transparency = 1 - m.opacity end
		mp.DoubleSided = m.doubleSided or false
		mp:SetAttribute("Joint", m.joint)
		mp:SetAttribute("Offset", CFrame.new(mid))
		-- a blank spot whose art goes in later (the trollface badges)
		if m.placeholder then mp:SetAttribute("Placeholder", m.placeholder); mp.Name = mp.Name .. "_PLACEHOLDER" end
		mp.CFrame = CFrame.new(mid)
		mp.Parent = traitModel(m.trait or "clothes")
		made += 1
		task.wait()
	end

	-- the character: a bare skeleton wearing its traits
	local char = Wear.build("TF_" .. index.token, index.joints, ORIGIN, K)
	for _, kind in ipairs({ "base", "clothes", "facial", "hat", "eyes" }) do
		if models[kind] then Wear.wear(char, models[kind]) end
	end
	local info = Instance.new("StringValue"); info.Name = "TF_Info"
	info.Value = ("TROLLS #%d from its traits (ServerStorage.TF_Traits). 1 m = %d studs, faces -Z, joints = rig.parts names. Made from code: re-import after reopening."):format(index.token, K)
	info.Parent = char

	-- the shelf: each trait on its own, as if on an invisible troll, labelled
	local shelf = workspace:FindFirstChild("TF_TraitShelf") or Instance.new("Model")
	shelf.Name = "TF_TraitShelf"; shelf.Parent = workspace
	local ghost = Wear.build("TF_ShelfGhost", index.joints, Vector3.zero, K)   -- joint rest frames only
	local x = 0
	for _, kind in ipairs({ "clothes", "facial", "hat", "eyes", "base" }) do
		local t = models[kind]
		if t then
			local spot = shelf:FindFirstChild(kind .. ": " .. t.Name); if spot then spot:Destroy() end
			spot = Instance.new("Model"); spot.Name = kind .. ": " .. t.Name
			local at = CFrame.new(SHELF + Vector3.new(x, 0, 0))
			for _, p in ipairs(t:GetChildren()) do
				if p:IsA("BasePart") then
					local j = ghost:FindFirstChild(p:GetAttribute("Joint")) or ghost.PrimaryPart
					local c = p:Clone(); c.Anchored = true
					c.CFrame = at * j.CFrame * p:GetAttribute("Offset")
					c.Parent = spot
				end
			end
			local tag = Instance.new("Part"); tag.Name = "Label"; tag.Anchored = true; tag.CanCollide = false
			tag.Transparency = 1; tag.Size = Vector3.one; tag.CFrame = at * CFrame.new(0, 2.3 * K, 0); tag.Parent = spot
			local gui = Instance.new("BillboardGui"); gui.Size = UDim2.fromOffset(220, 46); gui.AlwaysOnTop = true; gui.Parent = tag
			local lbl = Instance.new("TextLabel"); lbl.Size = UDim2.fromScale(1, 1); lbl.BackgroundTransparency = 0.3
			lbl.BackgroundColor3 = Color3.fromRGB(20, 20, 24); lbl.TextColor3 = Color3.new(1, 1, 1); lbl.TextScaled = true
			lbl.Font = Enum.Font.GothamBold; lbl.Text = kind .. ": " .. t.Name; lbl.Parent = gui
			spot.Parent = shelf
			x += 1.6 * K
		end
	end
	ghost:Destroy()
	local list = {}
	for kind, t in pairs(models) do table.insert(list, kind .. "=" .. t.Name .. " (" .. #t:GetChildren() .. ")") end
	return made .. " pieces; traits " .. table.concat(list, ", ")
end)
pcall(function() HttpService:GetAsync(base .. "/done") end)
HttpService.HttpEnabled = was
if not ok then error(res) end
return res
