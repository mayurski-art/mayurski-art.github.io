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
--   gen        every MeshPart made in Studio (generate_mesh): where it stands,
--              and once each, its mesh (EditableMesh: corners, normals, UVs)
--              and its texture (EditableImage, at most 512 px, base64 RGBA)
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
	local AssetService = game:GetService("AssetService")
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
				table.insert(marks, { m = p:GetAttribute("M"), name = p.Name, p = { pos.X / K, pos.Y / K, pos.Z / K },
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
			elseif p:IsA("MeshPart") and not inFolder(p, "Lights") and not inFolder(p, "Markers") then
				-- made in Studio (generate_mesh): its own mesh and texture
				local tex = p.TextureID
				local sa = p:FindFirstChildOfClass("SurfaceAppearance")
				if tex == "" and sa then tex = sa.ColorMap end
				table.insert(parts, { gen = p.MeshId, tex = tex ~= "" and tex or nil, cf = cfOut(U * p.CFrame), s = sz(p.Size), ms = sz(p.MeshSize),
					color = { p.Color.R, p.Color.G, p.Color.B }, name = p.Name, path = modelPath(p), solid = p.CanCollide, pen = p:GetAttribute("Pen") })
			elseif not inFolder(p, "Lights") and not inFolder(p, "Markers") then
				-- new: made in Studio
				table.insert(parts, { new = p:IsA("Part") and p.Shape.Name or p.ClassName, cf = cfOut(U * p.CFrame), s = sz(p.Size),
					color = { p.Color.R, p.Color.G, p.Color.B }, mat = p.Material.Name, alpha = 1 - p.Transparency, name = p.Name, path = modelPath(p),
					-- solid (CanCollide): a collider in the game too; Pen, if set, how much a bullet goes through
					solid = p.CanCollide, pen = p:GetAttribute("Pen") })
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
		-- each generated mesh and texture, once
		local sentMesh, sentTex = {}, {}
		local function r4(v) return math.floor(v * 1e4 + 0.5) / 1e4 end
		local ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
		local A = {}
		for i = 1, 64 do A[i - 1] = string.sub(ALPHA, i, i) end
		for _, e in ipairs(parts) do
			if e.gen and not sentMesh[e.gen] then
				sentMesh[e.gen] = true
				local em = AssetService:CreateEditableMeshAsync(Content.fromUri(e.gen))
				local P, N, UV = {}, {}, {}
				for i, fc in ipairs(em:GetFaces()) do
					local vs, ns, us = em:GetFaceVertices(fc), em:GetFaceNormals(fc), em:GetFaceUVs(fc)
					for k = 1, 3 do
						local v = em:GetPosition(vs[k])
						local n = ns[k] and em:GetNormal(ns[k]) or Vector3.yAxis
						local u = us[k] and em:GetUV(us[k]) or Vector2.zero
						table.insert(P, r4(v.X)); table.insert(P, r4(v.Y)); table.insert(P, r4(v.Z))
						table.insert(N, r4(n.X)); table.insert(N, r4(n.Y)); table.insert(N, r4(n.Z))
						table.insert(UV, r4(u.X)); table.insert(UV, r4(u.Y))
					end
					if i % 2000 == 0 then task.wait() end
				end
				em:Destroy()
				post("gen-mesh", { id = e.gen, p = P, n = N, uv = UV })
			end
			if e.tex and not sentTex[e.tex] then
				sentTex[e.tex] = true
				local img = AssetService:CreateEditableImageAsync(Content.fromUri(e.tex))
				local W, H = img.Size.X, img.Size.Y
				local src = img:ReadPixelsBuffer(Vector2.zero, img.Size)
				img:Destroy()
				-- at most 512 px: each f x f block averaged
				local f = math.max(1, math.ceil(math.max(W, H) / 512))
				local w, h = math.floor(W / f), math.floor(H / f)
				local buf = src
				if f > 1 then
					buf = buffer.create(w * h * 4)
					local ff = f * f
					for y = 0, h - 1 do
						for x = 0, w - 1 do
							local r, g, b, a = 0, 0, 0, 0
							for dy = 0, f - 1 do
								local o = ((y * f + dy) * W + x * f) * 4
								for dx = 0, f - 1 do
									local q = o + dx * 4
									r += buffer.readu8(src, q); g += buffer.readu8(src, q + 1); b += buffer.readu8(src, q + 2); a += buffer.readu8(src, q + 3)
								end
							end
							local p = (y * w + x) * 4
							buffer.writeu8(buf, p, r // ff); buffer.writeu8(buf, p + 1, g // ff); buffer.writeu8(buf, p + 2, b // ff); buffer.writeu8(buf, p + 3, a // ff)
						end
						if y % 64 == 0 then task.wait() end
					end
				end
				local n, out = buffer.len(buf), {}
				for o = 0, n - 1, 3 do
					local a = buffer.readu8(buf, o)
					local b = o + 1 < n and buffer.readu8(buf, o + 1) or 0
					local c = o + 2 < n and buffer.readu8(buf, o + 2) or 0
					local v = a * 65536 + b * 256 + c
					out[#out + 1] = A[bit32.rshift(v, 18)] .. A[bit32.band(bit32.rshift(v, 12), 63)]
						.. (o + 1 < n and A[bit32.band(bit32.rshift(v, 6), 63)] or "=") .. (o + 2 < n and A[bit32.band(v, 63)] or "=")
					if o % 300000 == 0 then task.wait() end
				end
				local b64 = table.concat(out)
				local SL = 600000
				local np = math.ceil(#b64 / SL)
				for i = 1, np do
					post("gen-tex", { id = e.tex, w = w, h = h, i = i, n = np, b64 = string.sub(b64, (i - 1) * SL + 1, i * SL) })
					task.wait()
				end
			end
		end
		post("colliders", cols)
		post("markers", marks)
		return post("end", { parts = #parts, colliders = #cols, markers = #marks })
	end)
	HttpService.HttpEnabled = HS
	if not ok then error("post: " .. tostring(res)) end
	return ("sent %d parts, %d colliders, %d markers: %s"):format(#parts, #cols, #marks, res)
end
