-- Send one TF_Rig animation to tools/troll-ops-roblox-anim.mjs (run "serve" first).
-- Run in Studio's command bar (Edit mode) or through the Studio MCP. Set SEQ to
-- the KeyframeSequence under workspace.TF_Rig.AnimSaves and CLIP to the game
-- clip name (characters/clips/<CLIP>.json).
local SEQ, CLIP, PORT = "TF_Sprint", "sprint", 5299

local HttpService = game:GetService("HttpService")
local rig = workspace.TF_Rig
local kfs = rig.AnimSaves:FindFirstChild(SEQ)
assert(kfs, "no KeyframeSequence " .. SEQ .. " under TF_Rig.AnimSaves")
local K = 4
local keys = kfs:GetKeyframes()
table.sort(keys, function(a, b) return a.Time < b.Time end)
local out = {}
for _, kf in ipairs(keys) do
	local poses, markers = {}, {}
	for _, d in ipairs(kf:GetDescendants()) do
		if d:IsA("Pose") then
			poses[d.Name] = { cf = { d.CFrame:GetComponents() }, w = d.Weight, ease = d.EasingStyle.Name, dir = d.EasingDirection.Name }
		elseif d:IsA("KeyframeMarker") then
			table.insert(markers, d.Name)
		end
	end
	table.insert(out, { t = kf.Time, poses = poses, markers = markers })
end
local meta = kfs:FindFirstChild("TF_Meta")
local body = HttpService:JSONEncode({
	name = CLIP, source = SEQ, K = K, loop = kfs.Loop, length = keys[#keys].Time,
	meta = meta and meta.Value or "", keyframes = out,
})
local was = HttpService.HttpEnabled
HttpService.HttpEnabled = true
local ok, res = pcall(function()
	return HttpService:RequestAsync({ Url = "http://127.0.0.1:" .. PORT .. "/anim", Method = "POST",
		Headers = { ["Content-Type"] = "application/json" }, Body = body })
end)
HttpService.HttpEnabled = was
if not ok then error("send failed: " .. tostring(res)) end
return res.StatusCode .. " " .. res.Body
