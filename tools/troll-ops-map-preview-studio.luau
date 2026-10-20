-- Build the preview tools/troll-ops-map-preview-studio.mjs serves (run it
-- first) into workspace.TC_Preview.<name>: the game's code-drawn pieces in
-- one area (the chapel, the town hall, the east shops), locked, outside
-- TrollCity_Live so the export never sees them. Runs in the background:
-- watch _G.TC_Preview (phase, parts, meshes; done or err).
--
--   (paste and run in the Edit datamodel; PORT below)
local PORT = 5298
local K = 3
local HttpService = game:GetService("HttpService")
local AssetService = game:GetService("AssetService")
local status = { phase = "start" }
_G.TC_Preview = status
task.spawn(function()
	local base = "http://127.0.0.1:" .. PORT
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
	local function material(n)
		local ok, m = pcall(function() return Enum.Material[n] end)
		return ok and m or Enum.Material.SmoothPlastic
	end
	local B64 = {}
	do
		local alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
		for i = 1, 64 do B64[string.byte(alphabet, i)] = i - 1 end
	end
	local function image(s, w, h)
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
		return img
	end

	local wasHttp = HttpService.HttpEnabled
	HttpService.HttpEnabled = true
	local ok, err = pcall(function()
		local data = HttpService:JSONDecode(getBig("/preview.json"))
		local mats = data.mats
		-- the game's frame: world studs are metres x 3, the town's drift undone (see from-studio)
		local tc = workspace:FindFirstChild("TrollCity_Live")
		local toWorld = tc and ((tc:GetAttribute("Home") or tc:GetPivot()) * tc:GetPivot():Inverse()):Inverse() or CFrame.new()
		local top = workspace:FindFirstChild("TC_Preview")
		if not top then top = Instance.new("Folder"); top.Name = "TC_Preview"; top.Parent = workspace end
		local old = top:FindFirstChild(data.name)
		if old then old:Destroy() end
		local model = Instance.new("Model"); model.Name = data.name
		local function lock(p) p.Locked = true; p.Anchored = true; p.CanCollide = false; p.CastShadow = true end

		status.phase = "parts"
		local SHAPE = { b = Enum.PartType.Block, c = Enum.PartType.Cylinder, s = Enum.PartType.Ball }
		for n, p in ipairs(data.parts) do
			local mat = mats[p.m + 1]
			local part = Instance.new("Part")
			part.Shape = SHAPE[p.k]
			part.Size = Vector3.new(p.s[1], p.s[2], p.s[3]) * K
			local f = p.f
			part.CFrame = toWorld * CFrame.fromMatrix(Vector3.new(p.p[1], p.p[2], p.p[3]) * K,
				Vector3.new(f[1], f[2], f[3]), Vector3.new(f[4], f[5], f[6]), Vector3.new(f[7], f[8], f[9]))
			part.Color = Color3.new(mat.color[1], mat.color[2], mat.color[3])
			part.Material = material(mat.rbx)
			if mat.alpha < 1 then part.Transparency = 1 - mat.alpha end
			part.TopSurface = Enum.SurfaceType.Smooth; part.BottomSurface = Enum.SurfaceType.Smooth
			part.Name = mat.name
			lock(part)
			part.Parent = model
			status.parts = n
			if n % 500 == 0 then task.wait() end
		end
		model.Parent = top

		status.phase = "images"
		local imgs = {}
		for _, im in ipairs(data.images) do
			imgs[im.i] = { img = image(getBig("/img-" .. im.i), im.w, im.h), flipY = im.flipY }
			task.wait()
		end

		status.phase = "meshes"
		for n, m in ipairs(data.meshes) do
			local mat = mats[m.mat + 1]
			local nv = #m.v / 3
			local lo, hi = Vector3.one * math.huge, -Vector3.one * math.huge
			for v = 0, nv - 1 do
				local p = Vector3.new(m.v[v*3+1], m.v[v*3+2], m.v[v*3+3]) * K
				lo = lo:Min(p); hi = hi:Max(p)
			end
			local mid = (lo + hi) / 2
			local tex = mat.img >= 0 and imgs[mat.img] or nil
			local em = AssetService:CreateEditableMesh()
			local vid, nid, uid = {}, {}, {}
			for v = 0, nv - 1 do
				vid[v] = em:AddVertex(Vector3.new(m.v[v*3+1], m.v[v*3+2], m.v[v*3+3]) * K - mid)
				nid[v] = em:AddNormal(Vector3.new(m.n[v*3+1], m.n[v*3+2], m.n[v*3+3]))
				local u, w = m.uv[v*2+1], m.uv[v*2+2]
				if not tex or tex.flipY then w = 1 - w end
				uid[v] = em:AddUV(Vector2.new(u, w))
			end
			for t = 0, #m.tri / 3 - 1 do
				local a, b, c = m.tri[t*3+1], m.tri[t*3+2], m.tri[t*3+3]
				local fc = em:AddTriangle(vid[a], vid[b], vid[c])
				em:SetFaceNormals(fc, { nid[a], nid[b], nid[c] })
				em:SetFaceUVs(fc, { uid[a], uid[b], uid[c] })
				if t % 4000 == 3999 then task.wait() end
			end
			local okMesh, mp = pcall(function() return AssetService:CreateMeshPartAsync(Content.fromObject(em)) end)
			if okMesh then
				mp.Name = mat.name
				mp.Material = material(mat.rbx)
				if tex then
					mp.TextureContent = Content.fromObject(tex.img)
					mp.Color = Color3.new(1, 1, 1)
					mp.Material = Enum.Material.SmoothPlastic
				else
					mp.Color = Color3.new(mat.color[1], mat.color[2], mat.color[3])
				end
				if mat.alpha < 1 then mp.Transparency = 1 - mat.alpha end
				mp.DoubleSided = mat.both or mat.cutout or false
				mp.CFrame = toWorld * CFrame.new(mid)
				lock(mp)
				mp.Parent = model
			end
			status.meshes = n
			task.wait()
		end
	end)
	HttpService.HttpEnabled = wasHttp
	pcall(function() HttpService:RequestAsync({ Url = "http://127.0.0.1:" .. PORT .. "/done", Method = "GET" }) end)
	status.phase = ok and "done" or "err"
	status.err = not ok and tostring(err) or nil
end)
return "preview building in the background: watch _G.TC_Preview"
