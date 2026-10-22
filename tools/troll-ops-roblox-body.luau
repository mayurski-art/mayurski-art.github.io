-- Troll Forces: send a Roblox Studio body (generate_mesh, five parts) to
-- tools/troll-ops-roblox-receive.mjs as OBJ + raw RGBA per part, for
-- tools/troll-ops-roblox-body.mjs to cut into the game's kit pieces.
-- Run in Studio's Edit datamodel (the Studio MCP's execute_luau, or the
-- command bar) with the receiver up:
--   node tools/troll-ops-roblox-receive.mjs .claude/roblox-export/<id>
-- The model must face -Z with its right arm on +X (turn it first). OBJ is in
-- character space: studs, feet at y 0, centred on the model, V flipped.
local MODEL = "TROLLS1718_Runner_v2"
local PORT = 5296

local AssetService = game:GetService("AssetService")
local HttpService = game:GetService("HttpService")
local Enc = game:GetService("EncodingService")
local m = workspace[MODEL]
local bb, size = m:GetBoundingBox()
local origin = Vector3.new(bb.Position.X, bb.Position.Y - size.Y / 2, bb.Position.Z)
-- generate_mesh's part names -> the body tool's
local NAMES = { ["torso_geom"] = "torso", ["left arm_geom"] = "left_arm", ["right arm_geom"] = "right_arm",
	["left leg_geom"] = "left_leg", ["right leg_geom"] = "right_leg" }
local function post(path, body)
	local r = HttpService:RequestAsync({ Url = "http://127.0.0.1:" .. PORT .. path, Method = "POST", Body = body })
	assert(r.Success, path .. " " .. r.StatusCode .. " " .. r.Body)
end

local was = HttpService.HttpEnabled
HttpService.HttpEnabled = true
local log = {}
local ok, err = pcall(function()
	for _, p in ipairs(m:GetDescendants()) do
		local name = p:IsA("MeshPart") and NAMES[p.Name]
		if name then
			local em = AssetService:CreateEditableMeshAsync(Content.fromUri(p.MeshId))
			local k = p.Size / p.MeshSize
			local rot = p.CFrame.Rotation
			local lines, vi, ti, ni = {}, {}, {}, {}
			local nv, nt, nn = 0, 0, 0
			for _, f in ipairs(em:GetFaces()) do
				local vs, uvs, ns = em:GetFaceVertices(f), em:GetFaceUVs(f), em:GetFaceNormals(f)
				local idx = {}
				for c = 1, 3 do
					local v, u, n = vs[c], uvs[c], ns[c]
					if not vi[v] then
						nv += 1; vi[v] = nv
						local w = p.CFrame * (em:GetPosition(v) * k) - origin
						table.insert(lines, string.format("v %.5f %.5f %.5f", w.X, w.Y, w.Z))
					end
					if u and not ti[u] then
						nt += 1; ti[u] = nt
						local uv = em:GetUV(u)
						table.insert(lines, string.format("vt %.5f %.5f", uv.X, 1 - uv.Y))
					end
					if n and not ni[n] then
						nn += 1; ni[n] = nn
						local w = rot * em:GetNormal(n)
						table.insert(lines, string.format("vn %.4f %.4f %.4f", w.X, w.Y, w.Z))
					end
					idx[c] = vi[v] .. "/" .. (u and ti[u] or "") .. "/" .. (n and ni[n] or "")
				end
				table.insert(lines, "f " .. table.concat(idx, " "))
			end
			post("/obj?name=" .. name, table.concat(lines, "\n"))
			local img = AssetService:CreateEditableImageAsync(Content.fromUri(p.TextureID))
			local sz = img.Size
			local b64 = buffer.tostring(Enc:Base64Encode(img:ReadPixelsBuffer(Vector2.zero, sz)))
			post(string.format("/png?name=%s&w=%d&h=%d", name, sz.X, sz.Y), b64)
			table.insert(log, string.format("%s: %d verts, %d tris, tex %dx%d", name, nv, #em:GetFaces(), sz.X, sz.Y))
			em:Destroy(); img:Destroy()
			task.wait()
		end
	end
end)
HttpService.HttpEnabled = was
if not ok then return "FAILED: " .. tostring(err) .. "\n" .. table.concat(log, "\n") end
return string.format("origin %s size %s\n", tostring(origin), tostring(size)) .. table.concat(log, "\n")
