-- Troll Forces: build an NFT body as the game draws it in Roblox Studio, from
-- tools/troll-ops-studio-preview.mjs (serving on 127.0.0.1). Run in Studio's
-- Edit datamodel (the Studio MCP's execute_luau, or the command bar). Each
-- piece is a MeshPart made from an EditableMesh with its texture an
-- EditableImage: they show while this Studio session is open and aren't
-- saved with the place. Stands at AT (feet on the floor), facing -Z.
local PORT = 5297
local AT = Vector3.new(5, 0, 0)

local AssetService = game:GetService("AssetService")
local HttpService = game:GetService("HttpService")
local Enc = game:GetService("EncodingService")
local function get(path)
	return HttpService:GetAsync("http://127.0.0.1:" .. PORT .. path)
end

local was = HttpService.HttpEnabled
HttpService.HttpEnabled = true
local log = {}
local ok, err = pcall(function()
	local man = HttpService:JSONDecode(get("/manifest"))
	local name = "TROLLS" .. man.token .. "_InGame"
	local old = workspace:FindFirstChild(name)
	if old then old:Destroy() end
	local model = Instance.new("Model")
	model.Name = name
	local images = {}
	local function image(i)
		if not images[i] then
			local t = man.textures[i + 1]
			local img = AssetService:CreateEditableImage({ Size = Vector2.new(t.w, t.h) })
			img:WritePixelsBuffer(Vector2.zero, Vector2.new(t.w, t.h), Enc:Base64Decode(buffer.fromstring(get("/tex?i=" .. i))))
			images[i] = img
		end
		return images[i]
	end
	local lowest = math.huge
	local parts = {}
	for i = 0, man.meshes - 1 do
		local m = HttpService:JSONDecode(get("/mesh?i=" .. i))
		local em = AssetService:CreateEditableMesh()
		-- centred on its own bounds: the MeshPart sits at the centre
		local lo, hi = Vector3.one * math.huge, -Vector3.one * math.huge
		for k = 1, #m.v, 3 do
			local p = Vector3.new(m.v[k], m.v[k + 1], m.v[k + 2])
			lo, hi = lo:Min(p), hi:Max(p)
		end
		local c = (lo + hi) / 2
		local vs, us = {}, {}
		for k = 1, #m.v, 3 do
			vs[#vs + 1] = em:AddVertex(Vector3.new(m.v[k], m.v[k + 1], m.v[k + 2]) - c)
			if m.u then us[#us + 1] = em:AddUV(Vector2.new(m.u[(k - 1) / 3 * 2 + 1], m.u[(k - 1) / 3 * 2 + 2])) end
		end
		for k = 1, #m.f, 3 do
			local a, b, d = m.f[k] + 1, m.f[k + 1] + 1, m.f[k + 2] + 1
			local fid = em:AddTriangle(vs[a], vs[b], vs[d])
			if m.u then em:SetFaceUVs(fid, { us[a], us[b], us[d] }) end
		end
		local part = AssetService:CreateMeshPartAsync(Content.fromObject(em))
		part.Name = m.name
		part.Anchored = true
		part.CFrame = CFrame.new(c)
		part.Color = Color3.fromHex(m.color)
		if m.tex ~= nil then
			local sa = Instance.new("SurfaceAppearance")
			sa.ColorMapContent = Content.fromObject(image(m.tex))
			sa.AlphaMode = m.alpha and Enum.AlphaMode.Transparency or Enum.AlphaMode.Overlay
			sa.Parent = part
		end
		part.Parent = model
		lowest = math.min(lowest, lo.Y)
		parts[#parts + 1] = part
		table.insert(log, string.format("%s: %d tris", m.name, #m.f / 3))
		task.wait()
	end
	-- feet on the floor at AT
	for _, p in ipairs(parts) do p.CFrame = p.CFrame + (AT - Vector3.new(0, lowest, 0)) end
	model.Parent = workspace
	pcall(get, "/done")
end)
HttpService.HttpEnabled = was
if not ok then return "FAILED: " .. tostring(err) .. "\n" .. table.concat(log, "\n") end
return table.concat(log, "\n")
