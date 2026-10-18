-- KillClips (ModuleScript in ReplicatedStorage.TrollUs): the three kill clips, stab, shoot and tongue.
-- Played in the world by TrollUsClient (everyone near sees it) and inside the victim's close-up by
-- TrollUsHUD, from the same code so the two always match. Props only: the killer's face never moves.
local RunService = game:GetService("RunService")

local KillClips = {}
KillClips.LENGTH = 0.8

local function part(props, parent)
	local p = Instance.new("Part")
	p.Anchored = true; p.CanCollide = false; p.CanQuery = false; p.CanTouch = false; p.CastShadow = false
	p.TopSurface = Enum.SurfaceType.Smooth; p.BottomSurface = Enum.SurfaceType.Smooth
	p.Material = Enum.Material.SmoothPlastic
	for k, v in pairs(props) do p[k] = v end
	p.Parent = parent
	return p
end

-- 0..1 over [a, b] of the clip's clock
local function span(t, a, b) return math.clamp((t - a) / (b - a), 0, 1) end

-- origin and target are feet positions (killer, victim); parts go into `parent` (a world folder or a
-- ViewportFrame). Returns at once; the clip animates itself and cleans up after LENGTH seconds.
function KillClips.play(parent, clip, origin, target)
	-- callers may pass root positions (2.8 up); every height below is measured from the floor
	origin = Vector3.new(origin.X, 0, origin.Z)
	target = Vector3.new(target.X, 0, target.Z)
	local flatTo = Vector3.new(target.X - origin.X, 0, target.Z - origin.Z)
	local dir = flatTo.Magnitude > 0.05 and flatTo.Unit or Vector3.new(0, 0, -1)
	local right = dir:Cross(Vector3.yAxis)
	local up = Vector3.yAxis
	local parts = {}
	local update

	if clip == "Stab" then
		local blade = part({ Size = Vector3.new(0.14, 0.5, 1.8), Color = Color3.fromRGB(215, 220, 230), Material = Enum.Material.Metal }, parent)
		local handle = part({ Size = Vector3.new(0.34, 0.44, 0.6), Color = Color3.fromRGB(70, 44, 30) }, parent)
		parts = { blade, handle }
		local start = origin + dir * 1.3 + up * 3.0 + right * 0.8 -- just under the killer's eye (3.6), so it reads in first person
		local hit = target - dir * 1.9 + up * 3.0 + right * 0.3 -- the near side of the victim, not inside them
		update = function(t)
			local k = t < 0.3 and span(t, 0.12, 0.3) or (t < 0.55 and 1 or 1 - span(t, 0.55, 0.8))
			local p = start:Lerp(hit, k)
			-- turned 55 degrees across the view and tipped up, so the blade shows side-on instead of hiding behind its handle
			local cf = CFrame.lookAt(p, p + dir) * CFrame.Angles(math.rad(18), math.rad(55), 0)
			handle.CFrame = cf
			blade.CFrame = cf * CFrame.new(0, 0, -1.2)
			local fade = span(t, 0.62, 0.8)
			blade.Transparency, handle.Transparency = fade, fade
		end
	elseif clip == "Shoot" then
		local gun = part({ Size = Vector3.new(0.34, 0.5, 1.3), Color = Color3.fromRGB(40, 42, 50) }, parent)
		local grip = part({ Size = Vector3.new(0.3, 0.7, 0.34), Color = Color3.fromRGB(40, 42, 50) }, parent)
		local flash = part({ Shape = Enum.PartType.Ball, Size = Vector3.new(1.3, 1.3, 1.3), Color = Color3.fromRGB(255, 220, 90),
			Material = Enum.Material.Neon, Transparency = 1 }, parent)
		local tracer = part({ Size = Vector3.new(0.1, 0.1, 1), Color = Color3.fromRGB(255, 240, 160), Material = Enum.Material.Neon, Transparency = 1 }, parent)
		parts = { gun, grip, flash, tracer }
		local base = origin + dir * 1.4 + up * 3.1 + right * 0.7
		local chest = target - dir * 1.2 + up * 3.0
		update = function(t)
			local recoil = (t > 0.3 and t < 0.45) and 0.35 * (1 - span(t, 0.3, 0.45)) or 0
			local p = base - dir * recoil + up * recoil * 0.4
			local cf = CFrame.lookAt(p, p + dir)
			gun.CFrame = cf
			grip.CFrame = cf * CFrame.new(0, -0.5, 0.35)
			local muzzle = p + dir * 0.8
			local firing = t >= 0.3 and t < 0.4
			flash.Position = muzzle
			flash.Transparency = firing and 0.1 or 1
			local len = (chest - muzzle).Magnitude
			tracer.Size = Vector3.new(0.1, 0.1, len)
			tracer.CFrame = CFrame.lookAt(muzzle, chest) * CFrame.new(0, 0, -len / 2)
			tracer.Transparency = (t >= 0.3 and t < 0.36) and 0 or 1
			local fade = span(t, 0.62, 0.8)
			gun.Transparency, grip.Transparency = fade, fade
		end
	else -- Tongue
		local pink = Color3.fromRGB(255, 105, 150)
		local tongue = part({ Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.1, 0.36, 0.36), Color = pink }, parent)
		local tip = part({ Shape = Enum.PartType.Ball, Size = Vector3.new(0.9, 0.9, 0.9), Color = pink }, parent)
		parts = { tongue, tip }
		local mouth = origin + dir * 2.2 + up * 2.9 -- below and ahead of the eye, so in first person it angles up instead of capping the view
		local face = target - dir * 1.5 + up * 3.6
		update = function(t)
			local k = t < 0.15 and span(t, 0, 0.15) or (t < 0.5 and 1 or 1 - span(t, 0.5, 0.75))
			local endPos = mouth:Lerp(face, k)
			local len = math.max(0.1, (endPos - mouth).Magnitude)
			-- a Cylinder's axis is X: turn the look (-Z) frame a quarter so X runs mouth to tip
			tongue.Size = Vector3.new(len, 0.36, 0.36)
			local aim = len > 0.15 and endPos or (mouth + dir) -- point mouth to tip; it runs uphill to the face
			tongue.CFrame = CFrame.lookAt(mouth, aim) * CFrame.new(0, 0, -len / 2) * CFrame.Angles(0, math.rad(90), 0)
			tip.Position = endPos
			local gone = (k <= 0.02 and t > 0.5) and 1 or 0
			tongue.Transparency, tip.Transparency = gone, gone
		end
	end

	update(0)
	task.spawn(function()
		local t = 0
		while t < KillClips.LENGTH do
			t += RunService.Heartbeat:Wait()
			update(t)
		end
		for _, p in ipairs(parts) do p:Destroy() end
	end)
end

return KillClips
