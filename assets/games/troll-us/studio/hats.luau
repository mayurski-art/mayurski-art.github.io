-- Hats (ModuleScript in ReplicatedStorage.TrollUs): eight hats built from Parts and welded to the dome.
-- Used by the server (everyone's bean) and the wardrobe preview. Each piece is placed in the dome's own
-- frame: origin at the dome's centre (1.6 radius), +Y up, front -Z. The goggle visor's lip tops out at
-- y +0.9 at the front, so nothing sits lower than that there.
local Hats = {}

local UP = CFrame.Angles(0, 0, math.rad(90)) -- turns a Cylinder (axis X) upright
local function cyl(y, h, d, color, extra)
	return { shape = Enum.PartType.Cylinder, size = Vector3.new(h, d, d), cf = CFrame.new(0, y, 0) * UP, color = color, extra = extra }
end
local function ball(pos, size, color, extra)
	return { shape = Enum.PartType.Ball, size = size, cf = CFrame.new(pos), color = color, extra = extra }
end
local function block(cf, size, color, extra)
	return { shape = Enum.PartType.Block, size = size, cf = cf, color = color, extra = extra }
end
local function tilt(pieces, degBack)
	local r = CFrame.Angles(math.rad(degBack), 0, 0) -- positive tips the top toward the back (+Z)
	for _, p in ipairs(pieces) do p.cf = r * p.cf end
	return pieces
end

local PURPLE, DPURPLE = Color3.fromRGB(107, 47, 187), Color3.fromRGB(80, 36, 150)
local GOLD = Color3.fromRGB(240, 190, 40)
local BLACK = Color3.fromRGB(30, 30, 34)
local BROWN, DBROWN = Color3.fromRGB(128, 82, 42), Color3.fromRGB(70, 44, 22)

local DEFS = {
	["Wizard Hat"] = function()
		local pieces = {
			cyl(1.15, 0.14, 3.3, DPURPLE),
			cyl(1.5, 0.6, 2.2, PURPLE), cyl(2.05, 0.6, 1.65, PURPLE), cyl(2.6, 0.6, 1.1, PURPLE), cyl(3.1, 0.5, 0.6, PURPLE),
			ball(Vector3.new(0, 2.05, -0.86), Vector3.new(0.42, 0.42, 0.42), Color3.fromRGB(255, 225, 80), { Material = Enum.Material.Neon }),
		}
		return tilt(pieces, 10)
	end,
	["Bandana"] = function()
		local red = Color3.fromRGB(200, 30, 40)
		return {
			cyl(0.98, 0.5, 2.78, red),
			ball(Vector3.new(0, 0.98, 1.4), Vector3.new(0.55, 0.55, 0.55), red),
			block(CFrame.new(0.2, 0.62, 1.52) * CFrame.Angles(0, 0, math.rad(20)), Vector3.new(0.16, 0.75, 0.38), red),
			block(CFrame.new(-0.2, 0.62, 1.52) * CFrame.Angles(0, 0, math.rad(-20)), Vector3.new(0.16, 0.75, 0.38), red),
		}
	end,
	["Crown"] = function()
		local pieces = { cyl(1.35, 0.55, 2.1, GOLD, { Material = Enum.Material.Metal }) }
		for k = 0, 4 do
			local a = math.rad(k * 72)
			table.insert(pieces, ball(Vector3.new(math.sin(a) * 0.95, 1.78, -math.cos(a) * 0.95), Vector3.new(0.38, 0.38, 0.38), GOLD, { Material = Enum.Material.Metal }))
		end
		table.insert(pieces, ball(Vector3.new(0, 1.35, -1.06), Vector3.new(0.32, 0.32, 0.32), Color3.fromRGB(230, 30, 60), { Material = Enum.Material.Neon }))
		return pieces
	end,
	["Top Hat"] = function()
		return {
			cyl(1.25, 0.12, 2.8, BLACK),
			cyl(2.05, 1.5, 1.8, BLACK),
			cyl(1.5, 0.3, 1.84, Color3.fromRGB(170, 20, 30)),
		}
	end,
	["Beanie"] = function()
		return {
			ball(Vector3.new(0, 1.0, 0.06), Vector3.new(3.36, 2.1, 3.36), Color3.fromRGB(40, 120, 200), { Material = Enum.Material.Fabric }),
			ball(Vector3.new(0, 2.1, 0.06), Vector3.new(0.8, 0.8, 0.8), Color3.fromRGB(240, 240, 245), { Material = Enum.Material.Fabric }),
		}
	end,
	["Sweatband"] = function() -- the runner's band
		return {
			cyl(0.95, 0.42, 2.8, Color3.fromRGB(245, 245, 248), { Material = Enum.Material.Fabric }),
			cyl(0.95, 0.14, 2.84, Color3.fromRGB(210, 30, 40), { Material = Enum.Material.Fabric }),
		}
	end,
	["Cowboy Hat"] = function()
		return {
			cyl(1.2, 0.12, 3.8, BROWN),
			cyl(1.75, 1.0, 1.9, BROWN),
			cyl(2.22, 0.1, 1.5, DBROWN),
			cyl(1.4, 0.24, 1.94, DBROWN),
		}
	end,
	["Beard"] = function() -- under the visor, on the body
		local hair = { Material = Enum.Material.Fabric }
		local col = Color3.fromRGB(90, 55, 30)
		return {
			ball(Vector3.new(0, -1.8, -1.15), Vector3.new(2.7, 1.7, 1.2), col, hair), -- the main bush under the visor
			ball(Vector3.new(0, -2.5, -1.35), Vector3.new(1.4, 1.0, 0.9), col, hair), -- the point at the chin (front at -1.8, proud of the body's -1.6)
		}
	end,
}

-- the order the wardrobe shows them in
Hats.LIST = { "None", "Wizard Hat", "Bandana", "Crown", "Top Hat", "Beanie", "Sweatband", "Cowboy Hat", "Beard" }

function Hats.wear(model, name)
	local old = model:FindFirstChild("Hat"); if old then old:Destroy() end
	model:SetAttribute("Hat", name or "None")
	local def = name and DEFS[name]
	local dome = model:FindFirstChild("Dome")
	if not def or not dome then return end
	local hat = Instance.new("Model"); hat.Name = "Hat"
	for _, spec in ipairs(def()) do
		local p = Instance.new("Part")
		p.Shape = spec.shape; p.Size = spec.size; p.Color = spec.color
		p.Material = Enum.Material.SmoothPlastic
		p.TopSurface = Enum.SurfaceType.Smooth; p.BottomSurface = Enum.SurfaceType.Smooth
		p.CanCollide = false; p.CanQuery = false; p.CanTouch = false; p.Massless = true
		p.Anchored = dome.Anchored
		for k, v in pairs(spec.extra or {}) do p[k] = v end
		p.CFrame = dome.CFrame * spec.cf
		p:SetAttribute("SuitShade", 0) -- the server's suit paint leaves hats their own colours
		p.CollisionGroup = dome.CollisionGroup
		if not p.Anchored then
			local w = Instance.new("WeldConstraint"); w.Part0 = dome; w.Part1 = p; w.Parent = p
		end
		p.Parent = hat
	end
	hat.Parent = model
end

return Hats
