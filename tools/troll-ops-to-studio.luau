-- Pull a TROLLS NFT character from tools/troll-ops-to-studio.mjs (run it first)
-- and build it in Studio as TF_<token>: joint parts named like the game's
-- rig.parts on Motor6Ds (the TF_Rig clips play on it), each piece a MeshPart
-- welded to its joint. Run in the command bar or through the Studio MCP, in
-- Edit mode. The meshes are made from code (EditableMesh): they live only in
-- this Studio session, so run both again after reopening the place.
local PORT = 5298
local K = 4                         -- studs per metre (TF_Rig's)
local ORIGIN = Vector3.new(12, 0, 0)

local HttpService = game:GetService("HttpService")
local AssetService = game:GetService("AssetService")
local base = "http://127.0.0.1:" .. PORT
local was = HttpService.HttpEnabled
HttpService.HttpEnabled = true
local function get(path) return HttpService:GetAsync(base .. path, true) end
local ok, err = pcall(function()
	local index = HttpService:JSONDecode(get("/index.json"))
	local name = "TF_" .. index.token
	local old = workspace:FindFirstChild(name); if old then old:Destroy() end
	local model = Instance.new("Model"); model.Name = name

	-- sRGB from the game's linear colours
	local function srgb(c) return c <= 0.0031308 and c * 12.92 or 1.055 * c ^ (1 / 2.4) - 0.055 end

	-- joints
	local root = Instance.new("Part")
	root.Name = "HumanoidRootPart"; root.Size = Vector3.one * 0.4 * K; root.Transparency = 1
	root.Anchored = true; root.CanCollide = false; root.CFrame = CFrame.new(ORIGIN); root.Parent = model
	model.PrimaryPart = root
	local parts = { root = root }
	local pending = index.joints
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

	-- textures (raw RGBA, base64, fetched a slice at a time)
	local B64 = {}
	local alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
	for i = 1, 64 do B64[string.byte(alphabet, i)] = i - 1 end
	local images = {}
	for _, t in ipairs(index.textures) do
		local chunks, from, SLICE = {}, 0, 1500000
		while from < t.chars do table.insert(chunks, get("/tex/" .. t.i .. ".b64?from=" .. from .. "&len=" .. SLICE)); from += SLICE end
		local s = table.concat(chunks)
		local buf = buffer.create(t.w * t.h * 4)
		local o, n = 0, #s
		for i = 1, n, 4 do
			local a, b, c, d = B64[string.byte(s, i)], B64[string.byte(s, i + 1)], B64[string.byte(s, i + 2) or 61] , B64[string.byte(s, i + 3) or 61]
			local v = bit32.lshift(a, 18) + bit32.lshift(b, 12) + bit32.lshift(c or 0, 6) + (d or 0)
			if o < t.w * t.h * 4 then buffer.writeu8(buf, o, bit32.rshift(v, 16)) end
			if c and o + 1 < t.w * t.h * 4 then buffer.writeu8(buf, o + 1, bit32.band(bit32.rshift(v, 8), 255)) end
			if d and o + 2 < t.w * t.h * 4 then buffer.writeu8(buf, o + 2, bit32.band(v, 255)) end
			o += 3
			if i % 400000 == 1 then task.wait() end
		end
		local img = AssetService:CreateEditableImage({ Size = Vector2.new(t.w, t.h) })
		img:WritePixelsBuffer(Vector2.zero, Vector2.new(t.w, t.h), buf)
		images[t.i] = { img = img, flipY = t.flipY }
		task.wait()
	end

	-- meshes
	local made = 0
	for _, info in ipairs(index.meshes) do
		local m = HttpService:JSONDecode(get("/mesh/" .. info.i .. ".json"))
		local joint = parts[m.joint] or root
		local nv = #m.v / 3
		-- centre the piece on its own box (a MeshPart sits on its mesh's centre)
		local lo, hi = Vector3.one * math.huge, -Vector3.one * math.huge
		for i = 0, nv - 1 do
			local p = Vector3.new(m.v[i*3+1], m.v[i*3+2], m.v[i*3+3]) * K
			lo = lo:Min(p); hi = hi:Max(p)
		end
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
		mp.Name = info.i .. "_" .. m.name
		mp.Anchored = false; mp.CanCollide = false; mp.Massless = true
		mp.Material = Enum.Material.SmoothPlastic
		if tex then
			mp.TextureContent = Content.fromObject(tex.img)
			mp.Color = Color3.new(1, 1, 1)
		else
			mp.Color = Color3.new(srgb(m.color[1]), srgb(m.color[2]), srgb(m.color[3]))
		end
		if m.opacity and m.opacity < 1 then mp.Transparency = 1 - m.opacity end
		mp.DoubleSided = m.doubleSided or false
		mp.CFrame = joint.CFrame * CFrame.new(mid)
		mp.Parent = model
		local w = Instance.new("WeldConstraint"); w.Part0 = joint; w.Part1 = mp; w.Parent = mp
		made += 1
		task.wait()
	end

	local ac = Instance.new("AnimationController"); ac.Parent = model
	Instance.new("Animator").Parent = ac
	local info = Instance.new("StringValue"); info.Name = "TF_Info"
	info.Value = ("TROLLS #%d as the game builds it%s. 1 m = %d studs, faces -Z, joints = rig.parts names. Made from code: re-import after reopening."):format(index.token, index.pieces and (" on " .. index.pieces) or "", K)
	info.Parent = model
	model.Parent = workspace
	return made
end)
pcall(function() HttpService:GetAsync(base .. "/done") end)
HttpService.HttpEnabled = was
if not ok then error(err) end
return "built TF character: " .. tostring(err) .. " pieces"
