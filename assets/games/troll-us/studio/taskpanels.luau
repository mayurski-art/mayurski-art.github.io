-- TaskPanels (ModuleScript in ReplicatedStorage.TrollUs): the 17 task mini-games.
-- TaskPanels.open(area, task, info, finish) builds one game into `area` (the tablet's game region, laid out
-- in pixels from its size when it opens) and returns a cleanup function. The game calls finish() once,
-- when it is won; info carries { name, suit, scan = function() end } for Submit Scan.
-- Every control is at least 44 px so the panels work on a phone.
local UIS = game:GetService("UserInputService")
local RunService = game:GetService("RunService")

local TP = {}
TP.inset = Vector2.zero -- set by the HUD: what to add to input positions to get gui positions

local INK = Color3.fromRGB(20, 22, 30)
local WHITE = Color3.new(1, 1, 1)
local GREEN = Color3.fromRGB(68, 214, 44)
local RED = Color3.fromRGB(235, 50, 50)
local YELLOW = Color3.fromRGB(250, 210, 60)
local GREY = Color3.fromRGB(200, 205, 218)
local DEEP = Color3.fromRGB(26, 28, 36)
local STEEL = Color3.fromRGB(70, 74, 88)
local BOLD, BLACK = Enum.Font.GothamBold, Enum.Font.GothamBlack
local MIN = 44

-- ---------- gui bits, all placed by their centre in area pixels ----------
local function new(class, props, parent)
	local o = Instance.new(class)
	for k, v in pairs(props or {}) do o[k] = v end
	if parent then o.Parent = parent end
	return o
end
local function corner(o, r) new("UICorner", { CornerRadius = r and UDim.new(0, r) or UDim.new(0.5, 0) }, o); return o end
local function stroke(o, t, c) new("UIStroke", { Thickness = t or 2, Color = c or INK, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }, o); return o end
local function box(parent, x, y, w, h, color, z)
	return new("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromOffset(x, y), Size = UDim2.fromOffset(w, h),
		BackgroundColor3 = color, BorderSizePixel = 0, ZIndex = z or 52 }, parent)
end
local function text(parent, x, y, w, h, str, size, color, z)
	return new("TextLabel", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromOffset(x, y), Size = UDim2.fromOffset(w, h),
		BackgroundTransparency = 1, Text = str, Font = BLACK, TextSize = size or 18, TextColor3 = color or WHITE, TextWrapped = true, ZIndex = z or 56 }, parent)
end
local function button(parent, x, y, w, h, str, color, z)
	w, h = math.max(w, MIN), math.max(h, MIN)
	local b = new("TextButton", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromOffset(x, y), Size = UDim2.fromOffset(w, h),
		BackgroundColor3 = color or GREY, Text = str or "", Font = BLACK, TextSize = math.clamp(math.floor(h * 0.38), 14, 26), TextColor3 = INK,
		AutoButtonColor = false, ZIndex = z or 54 }, parent)
	corner(b, 10); stroke(b, 2)
	return b
end
-- a button made round (or with radius r): changes the corner it already has
local function rounded(b, r) b:FindFirstChildOfClass("UICorner").CornerRadius = r and UDim.new(0, r) or UDim.new(0.5, 0); return b end
local function setLine(f, a, b)
	local d = b - a
	f.Position = UDim2.fromOffset((a.X + b.X) / 2, (a.Y + b.Y) / 2)
	f.Size = UDim2.fromOffset(math.max(d.Magnitude, 1), f.Size.Y.Offset)
	f.Rotation = math.deg(math.atan2(d.Y, d.X))
end
local function line(parent, a, b, thick, color, z)
	local f = box(parent, 0, 0, 1, thick, color, z)
	setLine(f, a, b)
	return f
end
local function shuffle(t)
	for i = #t, 2, -1 do local j = math.random(i); t[i], t[j] = t[j], t[i] end
	return t
end
local function isPress(i) return i.UserInputType == Enum.UserInputType.MouseButton1 or i.UserInputType == Enum.UserInputType.Touch end
local function isMove(i) return i.UserInputType == Enum.UserInputType.MouseMovement or i.UserInputType == Enum.UserInputType.Touch end
local function posOf(g) return Vector2.new(g.Position.X.Offset, g.Position.Y.Offset) end
local function moveTo(g, p) g.Position = UDim2.fromOffset(p.X, p.Y) end

local GAMES = {}

-- ---------- 1. hold a lever ----------
local function lever(ctx, stuff)
	local a, W, H = ctx.area, ctx.W, ctx.H
	ctx.hint("Pull the lever down and hold it")
	local bx, bw, bh = W * 0.36, math.min(W * 0.36, 260), H * 0.74
	local bin = stroke(corner(box(a, bx, H * 0.5, bw, bh, STEEL), 12), 3)
	bin.ClipsDescendants = true
	local fill = box(bin, bw / 2, bh - 6, bw - 12, bh - 12, Color3.fromRGB(96, 84, 66), 53)
	fill.AnchorPoint = Vector2.new(0.5, 1)
	for k = 1, 40 do
		local s = math.random(16, 34)
		local bit = corner(box(fill, math.random(14, bw - 26), math.random(14, bh - 26), s, s, stuff[k % #stuff + 1], 54), 4)
		bit.Rotation = math.random(0, 90)
	end
	local tx, top, bot = W * 0.76, H * 0.2, H * 0.8
	corner(box(a, tx, H * 0.5, 16, bot - top + 24, DEEP))
	local handle = stroke(corner(box(a, tx, top, math.max(70, W * 0.13), math.max(MIN, H * 0.14), Color3.fromRGB(235, 70, 60), 55), 12), 3)
	local y, held, left = top, false, 1
	ctx.drag(handle, function() held = true end, function(p) y = math.clamp(p.Y, top, bot); handle.Position = UDim2.fromOffset(tx, y) end,
		function() held = false end)
	ctx.tick(function(dt)
		if not held then y += (top - y) * math.min(1, dt * 10); handle.Position = UDim2.fromOffset(tx, y) end
		if held and y >= bot - 10 then left = math.max(0, left - dt / 2.4) end
		fill.Size = UDim2.fromOffset(bw - 12, (bh - 12) * left)
		if left <= 0 then ctx.win() end
	end)
end
GAMES["Empty Garbage"] = function(ctx)
	lever(ctx, { Color3.fromRGB(120, 160, 70), Color3.fromRGB(150, 110, 60), Color3.fromRGB(200, 200, 210), Color3.fromRGB(90, 120, 160) })
end
GAMES["Empty Chute"] = function(ctx)
	lever(ctx, { Color3.fromRGB(70, 150, 60), Color3.fromRGB(100, 180, 80), Color3.fromRGB(60, 120, 50) })
end

-- ---------- 2. tap in order ----------
GAMES["Unlock Manifolds"] = function(ctx)
	local a, W, H = ctx.area, ctx.W, ctx.H
	ctx.hint("Press 1 to 10 in order")
	local bw = math.max(MIN, math.min((W - 40) / 5 - 10, 110))
	local bh = math.max(MIN, math.min(H * 0.3, 90))
	local nextN, btns = 1, {}
	for idx, n in ipairs(shuffle({ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 })) do
		local c, r = (idx - 1) % 5, math.floor((idx - 1) / 5)
		local b = button(a, W / 2 + (c - 2) * (bw + 10), H * 0.48 + (r - 0.5) * (bh + 12), bw, bh, tostring(n), GREY)
		btns[n] = b
		ctx.on(b.Activated, function()
			if n == nextN then
				b.BackgroundColor3 = GREEN; nextN += 1
				if nextN > 10 then ctx.win() end
			elseif n > nextN then
				nextN = 1
				for _, o in pairs(btns) do o.BackgroundColor3 = RED end
				task.delay(0.3, function() for _, o in pairs(btns) do o.BackgroundColor3 = GREY end end)
			end
		end)
	end
end

GAMES["Prime Shields"] = function(ctx)
	local a, W, H = ctx.area, ctx.W, ctx.H
	ctx.hint("Tap the red cells until the shield is whole")
	local s = math.max(MIN + 6, math.min(H * 0.25, W * 0.13))
	local cx, cy = W / 2, H * 0.48
	local spots = { Vector2.new(0, 0) }
	for k = 0, 5 do local ang = math.rad(30 + k * 60); table.insert(spots, Vector2.new(math.cos(ang), math.sin(ang)) * s * 1.14) end
	local cells, red = {}, 0
	local reds = shuffle({ 1, 2, 3, 4, 5, 6, 7 })
	local nRed = math.random(3, 5)
	for i, sp in ipairs(spots) do
		local isRed = table.find(reds, i) <= nRed
		local b = rounded(button(a, cx + sp.X, cy + sp.Y, s, s, "", isRed and RED or Color3.fromRGB(235, 240, 250)))
		cells[i] = { b = b, red = isRed }
		if isRed then red += 1 end
		ctx.on(b.Activated, function()
			local c = cells[i]
			c.red = not c.red
			red += c.red and 1 or -1
			b.BackgroundColor3 = c.red and RED or Color3.fromRGB(235, 240, 250)
			if red == 0 then
				for _, o in ipairs(cells) do o.b.BackgroundColor3 = Color3.fromRGB(120, 170, 255) end
				ctx.win()
			end
		end)
	end
end

GAMES["Clear Asteroids"] = function(ctx)
	local a, W, H = ctx.area, ctx.W, ctx.H
	local need, got = 12, 0
	local space = stroke(corner(box(a, W / 2, H * 0.47, W - 20, H * 0.82, Color3.fromRGB(8, 10, 20), 52), 10), 2)
	space.ClipsDescendants = true
	for _ = 1, 40 do local st = math.random(1, 3); box(space, math.random(0, W), math.random(0, H), st, st, Color3.fromRGB(200, 210, 255), 53) end
	local counter = ctx.hint("Destroyed: 0 / " .. need)
	local rocks = {}
	local spawnIn = 0
	local size = math.max(MIN + 6, H * 0.17)
	ctx.tick(function(dt)
		spawnIn -= dt
		if spawnIn <= 0 and #rocks < 4 then
			spawnIn = 0.7
			local r = button(space, W + size, math.random(size, math.floor(H * 0.82 - size)), size, size, "", Color3.fromRGB(150, 130, 110), 55)
			rounded(r)
			local rock = { g = r, vx = -W * math.random(20, 32) / 100, vy = math.random(-30, 30), spin = math.random(-120, 120) }
			table.insert(rocks, rock)
			ctx.on(r.Activated, function()
				if rock.dead then return end
				rock.dead = true
				got += 1
				counter.Text = "Destroyed: " .. got .. " / " .. need
				r.BackgroundColor3 = YELLOW
				task.delay(0.08, function() r:Destroy() end)
				if got >= need then ctx.win() end
			end)
		end
		for i = #rocks, 1, -1 do
			local k = rocks[i]
			if k.dead or not k.g.Parent then table.remove(rocks, i)
			else
				local p = posOf(k.g) + Vector2.new(k.vx, k.vy) * dt
				moveTo(k.g, p); k.g.Rotation += k.spin * dt
				if p.X < -size then k.g:Destroy(); table.remove(rocks, i) end
			end
		end
	end)
end

-- ---------- 3. drag ----------
GAMES["Fix Wiring"] = function(ctx)
	local a, W, H = ctx.area, ctx.W, ctx.H
	ctx.hint("Drag each wire to the same colour")
	local cols = { Color3.fromRGB(230, 50, 50), Color3.fromRGB(60, 110, 240), Color3.fromRGB(250, 210, 40), Color3.fromRGB(240, 90, 200) }
	local right = shuffle({ 1, 2, 3, 4 })
	local lx, rx = W * 0.12, W * 0.88
	local function ys(i) return H * 0.12 + (i - 0.5) * (H * 0.72 / 4) end
	local ends, fixed = {}, 0
	for slot, c in ipairs(right) do
		local e = stroke(box(a, rx, ys(slot), MIN, MIN * 0.7, cols[c], 54), 2)
		box(a, (rx + W) / 2, ys(slot), W - rx, 14, cols[c], 53)
		ends[c] = posOf(e)
	end
	for i, c in ipairs(cols) do
		local start = Vector2.new(lx, ys(i))
		box(a, lx / 2, start.Y, lx, 14, c, 53)
		local node = stroke(box(a, lx, start.Y, MIN, MIN * 0.7, c, 55), 2)
		local wire, done = nil, false
		ctx.drag(node, function()
			if done then return end
			wire = wire or line(a, start, start, 12, c, 54)
		end, function(p)
			if wire and not done then setLine(wire, start, p) end
		end, function(p)
			if not wire or done then return end
			if (p - ends[i]).Magnitude < 46 then
				done = true; setLine(wire, start, ends[i]); fixed += 1
				if fixed == 4 then ctx.win() end
			else
				wire:Destroy(); wire = nil
			end
		end)
	end
end

GAMES["Chart Course"] = function(ctx)
	local a, W, H = ctx.area, ctx.W, ctx.H
	ctx.hint("Drag the ship along the course")
	local pts = {}
	for i = 0, 4 do table.insert(pts, Vector2.new(W * (0.1 + i * 0.2), H * (0.2 + math.random() * 0.55))) end
	for i = 1, 4 do line(a, pts[i], pts[i + 1], 4, Color3.fromRGB(120, 140, 180), 52) end
	local marks = {}
	for i, p in ipairs(pts) do marks[i] = stroke(corner(box(a, p.X, p.Y, 20, 20, i == 1 and GREEN or Color3.fromRGB(90, 100, 130), 53)), 2) end
	local ship = stroke(corner(box(a, pts[1].X, pts[1].Y, MIN + 8, MIN + 8, YELLOW, 55)), 3)
	text(ship, (MIN + 8) / 2, (MIN + 8) / 2, MIN, MIN, ">", 26, INK, 56)
	local reached = 1
	ctx.drag(ship, nil, function(p)
		moveTo(ship, p)
		local nxt = pts[reached + 1]
		if nxt and (p - nxt).Magnitude < 34 then
			reached += 1
			marks[reached].BackgroundColor3 = GREEN
			if reached == #pts then ctx.win() end
		end
	end, nil)
end

GAMES["Stabilize Steering"] = function(ctx)
	local a, W, H = ctx.area, ctx.W, ctx.H
	ctx.hint("Drag the target into the middle")
	local c = Vector2.new(W / 2, H * 0.48)
	local d = math.min(H * 0.8, W * 0.6)
	stroke(corner(box(a, c.X, c.Y, d, d, Color3.fromRGB(16, 40, 60), 52)), 3)
	box(a, c.X, c.Y, d, 2, Color3.fromRGB(60, 150, 200), 53); box(a, c.X, c.Y, 2, d, Color3.fromRGB(60, 150, 200), 53)
	stroke(corner(box(a, c.X, c.Y, 34, 34, Color3.fromRGB(16, 40, 60), 53)), 2, Color3.fromRGB(120, 220, 255))
	local ang = math.random() * math.pi * 2
	local start = c + Vector2.new(math.cos(ang), math.sin(ang)) * d * 0.32
	local ret = stroke(corner(box(a, start.X, start.Y, MIN + 6, MIN + 6, Color3.fromRGB(240, 90, 60), 55)), 3)
	ctx.drag(ret, nil, function(p)
		local off = p - c
		if off.Magnitude > d / 2 - 20 then off = off.Unit * (d / 2 - 20) end
		moveTo(ret, c + off)
	end, function()
		if (posOf(ret) - c).Magnitude < 22 then moveTo(ret, c); ret.BackgroundColor3 = GREEN; ctx.win() end
	end)
end

GAMES["Clean O2 Filter"] = function(ctx)
	local a, W, H = ctx.area, ctx.W, ctx.H
	ctx.hint("Drag the leaves into the vent")
	local ventW = W * 0.18
	local vent = stroke(corner(box(a, ventW / 2 + 10, H * 0.47, ventW, H * 0.8, DEEP, 52), 10), 2)
	for k = 0, 4 do text(vent, ventW / 2, H * 0.1 + k * H * 0.15, ventW, 30, "<<", 22, Color3.fromRGB(90, 100, 120), 53) end
	stroke(corner(box(a, W * 0.62, H * 0.47, W * 0.66, H * 0.8, Color3.fromRGB(56, 62, 78), 52), 10), 2)
	local left = 6
	for _ = 1, 6 do
		local leaf = stroke(corner(box(a, W * (0.4 + math.random() * 0.45), H * (0.18 + math.random() * 0.58), MIN + 10, MIN - 6,
			Color3.fromRGB(70 + math.random(0, 40), 150 + math.random(0, 40), 60), 55)), 2)
		leaf.Rotation = math.random(-40, 40)
		local gone = false
		ctx.drag(leaf, nil, function(p) if not gone then moveTo(leaf, p) end end, function(p)
			if gone then return end
			if p.X < ventW + 20 then
				gone = true; leaf:Destroy(); left -= 1
				if left == 0 then ctx.win() end
			end
		end)
	end
end

GAMES["Swipe Card"] = function(ctx)
	local a, W, H = ctx.area, ctx.W, ctx.H
	local lcd = stroke(corner(box(a, W / 2, H * 0.12, W * 0.7, math.max(MIN, H * 0.14), Color3.fromRGB(30, 60, 40), 52), 8), 2)
	local msg = text(lcd, W * 0.35, math.max(MIN, H * 0.14) / 2, W * 0.66, 30, "PLEASE INSERT CARD", 18, Color3.fromRGB(120, 255, 140), 53)
	local trackY = H * 0.4
	stroke(corner(box(a, W / 2, trackY - 6, W * 0.9, math.max(MIN, H * 0.2), Color3.fromRGB(150, 155, 168), 52), 8), 2)
	box(a, W / 2, trackY, W * 0.86, 10, DEEP, 53)
	local x0, x1 = W * 0.16, W * 0.84
	local cw, ch = math.max(90, W * 0.18), math.max(MIN + 10, H * 0.22)
	local card = stroke(corner(box(a, W / 2, H * 0.72, cw, ch, Color3.fromRGB(240, 240, 250), 55), 8), 2)
	text(card, cw / 2, ch * 0.3, cw, 20, "CREW ID", 14, INK, 56)
	box(card, cw * 0.3, ch * 0.68, cw * 0.36, ch * 0.4, Color3.fromRGB(120, 160, 230), 56)
	local stage, t0 = "wallet", 0
	ctx.hint("Tap the card, then swipe it across at a steady pace")
	ctx.drag(card, function()
		if stage == "wallet" then
			stage = "ready"; moveTo(card, Vector2.new(x0, trackY)); msg.Text = "PLEASE SWIPE CARD"
		elseif stage == "ready" then
			t0 = os.clock()
		end
	end, function(p)
		if stage == "ready" then moveTo(card, Vector2.new(math.clamp(p.X, x0, x1), trackY)) end
	end, function()
		if stage ~= "ready" then return end
		local px = posOf(card).X
		if px >= x1 - 6 then
			local dt = os.clock() - t0
			if dt < 0.35 then msg.Text = "TOO FAST. TRY AGAIN."
			elseif dt > 2.0 then msg.Text = "TOO SLOW. TRY AGAIN."
			else msg.Text = "ACCEPTED. THANK YOU."; stage = "done"; ctx.win(); return end
		elseif px > x0 + 10 then
			msg.Text = "BAD READ. TRY AGAIN."
		end
		moveTo(card, Vector2.new(x0, trackY))
	end)
end

GAMES["Align Engine Output"] = function(ctx)
	local a, W, H = ctx.area, ctx.W, ctx.H
	ctx.hint("Line the output up with the dashed line")
	local top, bot = H * 0.12, H * 0.82
	local tx = W * 0.62
	stroke(corner(box(a, W * 0.4, (top + bot) / 2, W * 0.5, bot - top + 20, Color3.fromRGB(30, 34, 44), 52), 10), 2)
	corner(box(a, tx, (top + bot) / 2, 12, bot - top, DEEP, 53))
	local target = top + (bot - top) * (0.15 + math.random() * 0.7)
	for k = 0, 7 do box(a, W * 0.2 + k * W * 0.06, target, W * 0.035, 4, YELLOW, 53) end
	local y = (math.random() < 0.5) and top + 8 or bot - 8
	local beam = box(a, W * 0.4, y, W * 0.5, 6, Color3.fromRGB(80, 200, 255), 54)
	local handle = stroke(corner(box(a, tx, y, math.max(70, W * 0.1), MIN, Color3.fromRGB(80, 200, 255), 55), 10), 3)
	ctx.drag(handle, nil, function(p)
		y = math.clamp(p.Y, top, bot)
		moveTo(handle, Vector2.new(tx, y)); moveTo(beam, Vector2.new(W * 0.4, y))
	end, function()
		if math.abs(y - target) < 12 then handle.BackgroundColor3 = GREEN; beam.BackgroundColor3 = GREEN; ctx.win() end
	end)
end

-- ---------- 4. timing and sequence ----------
GAMES["Calibrate Distributor"] = function(ctx)
	local a, W, H = ctx.area, ctx.W, ctx.H
	ctx.hint("Press CALIBRATE as each needle passes the top")
	local cols = { Color3.fromRGB(250, 200, 40), Color3.fromRGB(60, 130, 240), Color3.fromRGB(60, 210, 210) }
	local speeds = { 150, 210, 270 }
	local rows, active = {}, 1
	local rh = H * 0.84 / 3
	local d = math.max(MIN, math.min(rh - 10, W * 0.16))
	for i = 1, 3 do
		local y = H * 0.06 + (i - 0.5) * rh
		local dial = stroke(corner(box(a, W * 0.3, y, d, d, DEEP, 52)), 3, cols[i])
		box(dial, d / 2, 4, 6, 10, WHITE, 53)
		local needle = box(dial, d / 2, d / 2, 6, d - 8, Color3.new(0, 0, 0), 54)
		needle.BackgroundTransparency = 1
		box(needle, 3, (d - 8) / 4, 6, (d - 8) / 2, cols[i], 55)
		local b = button(a, W * 0.68, y, W * 0.36, math.min(rh - 12, 70), "CALIBRATE", GREY)
		rows[i] = { needle = needle, ang = math.random(0, 359), b = b, done = false }
		ctx.on(b.Activated, function()
			if i ~= active then return end
			local r = rows[i]
			local off = (r.ang + 180) % 360 - 180
			if math.abs(off) < 24 then
				r.done = true; r.ang = 0; b.BackgroundColor3 = GREEN; active += 1
				if active > 3 then ctx.win() end
			else
				for _, o in ipairs(rows) do o.done = false; o.b.BackgroundColor3 = GREY end
				active = 1; b.BackgroundColor3 = RED
				task.delay(0.3, function() if active == 1 and b.Parent then b.BackgroundColor3 = GREY end end)
			end
		end)
	end
	ctx.tick(function(dt)
		for i, r in ipairs(rows) do
			if not r.done then r.ang = (r.ang + speeds[i] * dt) % 360 end
			if not r.done and r.b.BackgroundColor3 ~= RED then r.b.BackgroundColor3 = i == active and YELLOW or GREY end
			r.needle.Rotation = r.ang
		end
	end)
end

GAMES["Start Reactor"] = function(ctx)
	local a, W, H = ctx.area, ctx.W, ctx.H
	local hintL = ctx.hint("Watch the left, then repeat it on the right")
	local cell = math.max(MIN, math.min(H * 0.2, W * 0.12))
	local gap = 8
	local function grid(cx, isBtn)
		local out = {}
		for k = 1, 9 do
			local c, r = (k - 1) % 3 - 1, math.floor((k - 1) / 3) - 1
			local x, y = cx + c * (cell + gap), H * 0.5 + r * (cell + gap)
			out[k] = isBtn and button(a, x, y, cell, cell, "", Color3.fromRGB(60, 66, 80)) or stroke(corner(box(a, x, y, cell, cell, DEEP, 53), 8), 2)
		end
		return out
	end
	local show, press = grid(W * 0.26, false), grid(W * 0.74, true)
	local lights = {}
	for k = 1, 4 do lights[k] = stroke(corner(box(a, W / 2 + (k - 2.5) * 24, H * 0.12, 16, 16, DEEP, 53)), 1) end
	local seq, round, inputAt, busy = {}, 1, 1, true
	local function newSeq() seq = {}; for k = 1, 4 do seq[k] = math.random(1, 9) end end
	local function play()
		busy = true; inputAt = 1
		task.spawn(function()
			task.wait(0.5)
			for k = 1, round do
				if not ctx.alive then return end
				show[seq[k]].BackgroundColor3 = Color3.fromRGB(80, 160, 255)
				task.wait(0.42)
				if not ctx.alive then return end
				show[seq[k]].BackgroundColor3 = DEEP
				task.wait(0.16)
			end
			busy = false
		end)
	end
	newSeq(); play()
	for k, b in ipairs(press) do
		ctx.on(b.Activated, function()
			if busy then return end
			if k == seq[inputAt] then
				b.BackgroundColor3 = Color3.fromRGB(80, 160, 255)
				task.delay(0.15, function() if b.Parent then b.BackgroundColor3 = Color3.fromRGB(60, 66, 80) end end)
				inputAt += 1
				if inputAt > round then
					lights[round].BackgroundColor3 = GREEN
					round += 1
					if round > 4 then busy = true; ctx.win() else play() end
				end
			else
				for _, o in ipairs(press) do o.BackgroundColor3 = RED end
				for _, l in ipairs(lights) do l.BackgroundColor3 = DEEP end
				hintL.Text = "Wrong one. Watch again"
				task.delay(0.4, function() for _, o in ipairs(press) do if o.Parent then o.BackgroundColor3 = Color3.fromRGB(60, 66, 80) end end end)
				round = 1; newSeq(); play()
			end
		end)
	end
end

-- ---------- 5. stops: a start, a wait, a finish ----------
local function transfer(ctx, verb)
	local a, W, H = ctx.area, ctx.W, ctx.H
	ctx.hint(verb == "Download" and "Download the data" or "Upload the data")
	local fw, fh = math.max(70, W * 0.16), math.max(56, H * 0.3)
	for _, x in ipairs({ W * 0.18, W * 0.82 }) do
		local f = stroke(corner(box(a, x, H * 0.3, fw, fh, YELLOW, 52), 8), 2)
		box(f, fw * 0.3, -4, fw * 0.4, 12, YELLOW, 52)
	end
	local bar = stroke(corner(box(a, W / 2, H * 0.56, W * 0.7, 22, DEEP, 52), 11), 2)
	local fill = corner(box(bar, 0, 11, 0, 22, GREEN, 53), 11); fill.AnchorPoint = Vector2.new(0, 0.5)
	local info = text(a, W / 2, H * 0.3, W * 0.4, 40, "", 16, WHITE)
	local go = button(a, W / 2, H * 0.76, math.min(W * 0.4, 240), math.max(MIN, H * 0.15), string.upper(verb), YELLOW)
	local t, running = 0, false
	local papers = {}
	ctx.on(go.Activated, function() if not running then running = true; go.Visible = false end end)
	ctx.tick(function(dt)
		if not running then return end
		t += dt
		local k = math.clamp(t / 4.5, 0, 1)
		fill.Size = UDim2.fromOffset(W * 0.7 * k, 22)
		info.Text = k < 1 and ("Estimated time: " .. math.ceil(4.5 - t) .. "s") or "Complete"
		if #papers < 3 and math.random() < dt * 3 then
			table.insert(papers, { g = box(a, W * 0.22, H * 0.3, 18, 22, WHITE, 54), x = W * 0.22 })
		end
		for i = #papers, 1, -1 do
			local pp = papers[i]
			pp.x += W * 0.5 * dt
			moveTo(pp.g, Vector2.new(pp.x, H * 0.3 - math.sin((pp.x - W * 0.22) / (W * 0.56) * math.pi) * H * 0.18))
			if pp.x > W * 0.78 then pp.g:Destroy(); table.remove(papers, i) end
		end
		if k >= 1 then running = false; ctx.win() end
	end)
end
GAMES["Download Data"] = function(ctx) transfer(ctx, "Download") end
GAMES["Upload Data"] = function(ctx) transfer(ctx, "Upload") end

GAMES["Fuel Engines"] = function(ctx)
	local a, W, H = ctx.area, ctx.W, ctx.H
	ctx.hint("Hold the button to fill the tank")
	local tw, th = math.max(90, W * 0.2), H * 0.78
	local tank = stroke(corner(box(a, W * 0.32, H * 0.48, tw, th, DEEP, 52), 12), 3)
	tank.ClipsDescendants = true
	local fuel = box(tank, tw / 2, th, tw, 0, Color3.fromRGB(240, 170, 40), 53); fuel.AnchorPoint = Vector2.new(0.5, 1)
	for k = 1, 3 do box(tank, tw * 0.8, th * k / 4, tw * 0.3, 3, Color3.fromRGB(120, 124, 138), 54) end
	local b = button(a, W * 0.72, H * 0.48, math.min(W * 0.34, 220), math.max(MIN + 20, H * 0.3), "HOLD", YELLOW)
	local held, level = false, 0
	ctx.on(b.InputBegan, function(i) if isPress(i) then held = true end end)
	ctx.on(b.InputEnded, function(i) if isPress(i) then held = false end end)
	ctx.tick(function(dt)
		if held then level = math.min(1, level + dt / 3) end
		b.BackgroundColor3 = held and Color3.fromRGB(255, 230, 120) or YELLOW
		fuel.Size = UDim2.fromOffset(tw, th * level)
		if level >= 1 then ctx.win() end
	end)
end

GAMES["Divert Power"] = function(ctx)
	local a, W, H = ctx.area, ctx.W, ctx.H
	ctx.hint("Push the lit switch all the way up")
	local names = { "WEP", "O2", "NAV", "SHD", "COM", "ENG", "SEC", "MED" }
	local pick = math.random(1, 8)
	local top, bot = H * 0.12, H * 0.64
	local sp = (W - 40) / 8
	for i, n in ipairs(names) do
		local x = 20 + (i - 0.5) * sp
		corner(box(a, x, (top + bot) / 2, 10, bot - top, i == pick and YELLOW or DEEP, 52))
		text(a, x, H * 0.8, sp, 22, n, 14, i == pick and YELLOW or Color3.fromRGB(150, 156, 170))
		local h = stroke(corner(box(a, x, bot, math.max(MIN, sp - 10), MIN * 0.7, i == pick and WHITE or Color3.fromRGB(110, 114, 128), 54), 8), 2)
		if i == pick then
			local y = bot
			ctx.drag(h, nil, function(p) y = math.clamp(p.Y, top, bot); moveTo(h, Vector2.new(x, y)) end, function()
				if y <= top + 10 then h.BackgroundColor3 = GREEN; ctx.win() end
			end)
		end
	end
end

GAMES["Accept Diverted Power"] = function(ctx)
	local a, W, H = ctx.area, ctx.W, ctx.H
	ctx.hint("Flip the switch to accept the power")
	local y = H * 0.42
	local bw, bh = math.max(80, W * 0.17), math.max(MIN + 10, H * 0.3)
	local src = stroke(corner(box(a, W * 0.14, y, bw, bh, Color3.fromRGB(240, 190, 40), 53), 10), 2)
	text(src, bw / 2, bh / 2, bw, bh, "POWER", 16, INK, 54)
	local dst = stroke(corner(box(a, W * 0.86, y, bw, bh, STEEL, 53), 10), 2)
	local dstText = text(dst, bw / 2, bh / 2, bw - 8, bh, string.upper(ctx.info and ctx.info.room or "ROOM"), 14, WHITE, 54)
	local wireL = box(a, W * 0.32, y, W * 0.2, 10, Color3.fromRGB(240, 190, 40), 52)
	local wireR = box(a, W * 0.68, y, W * 0.2, 10, DEEP, 52)
	local sw = button(a, W / 2, y, math.min(W * 0.18, 130), math.max(MIN + 30, H * 0.42), "OFF", Color3.fromRGB(150, 156, 170))
	local on, t = false, 0
	ctx.on(sw.Activated, function()
		if on then return end
		on = true; sw.Text = "ON"; sw.BackgroundColor3 = GREEN; wireR.BackgroundColor3 = Color3.fromRGB(240, 190, 40)
		dst.BackgroundColor3 = Color3.fromRGB(240, 190, 40); dstText.TextColor3 = INK
		ctx.win()
	end)
	ctx.tick(function(dt)
		t += dt
		wireL.BackgroundTransparency = 0.25 + 0.25 * math.sin(t * 12)
		if on then wireR.BackgroundTransparency = 0.25 + 0.25 * math.sin(t * 12 - 1) end
	end)
end

GAMES["Inspect Sample"] = function(ctx)
	local a, W, H = ctx.area, ctx.W, ctx.H
	local hint = ctx.hint("Start the test")
	local tw, th = math.max(MIN, math.min(W * 0.1, 70)), H * 0.5
	local tubes = {}
	for i = 1, 5 do
		local x = W / 2 + (i - 3) * (tw + 16)
		local t = button(a, x, H * 0.4, tw, th, "", Color3.fromRGB(220, 226, 236))
		rounded(t, 14)
		local f = corner(box(t, tw / 2, th, tw, 0, Color3.fromRGB(80, 160, 230), 55), 14); f.AnchorPoint = Vector2.new(0.5, 1)
		tubes[i] = { b = t, f = f }
	end
	local go = button(a, W / 2, H * 0.76, math.min(W * 0.4, 240), math.max(MIN, H * 0.14), "START", YELLOW)
	local stage, t, bad = "idle", 0, 0
	ctx.on(go.Activated, function() if stage == "idle" then stage = "filling"; t = 0; go.Visible = false end end)
	for i, tb in ipairs(tubes) do
		ctx.on(tb.b.Activated, function()
			if stage ~= "pick" then return end
			if i == bad then stage = "done"; tb.f.BackgroundColor3 = GREEN; ctx.win()
			else
				hint.Text = "Not that one. Testing again"
				for _, o in ipairs(tubes) do o.f.BackgroundColor3 = Color3.fromRGB(80, 160, 230) end
				stage = "filling"; t = 2.5
			end
		end)
	end
	ctx.tick(function(dt)
		if stage ~= "filling" then return end
		t += dt
		local k = math.clamp(t / 6, 0, 1)
		for _, o in ipairs(tubes) do o.f.Size = UDim2.fromOffset(tw, th * k) end
		if stage == "filling" and k < 1 then hint.Text = "Testing: " .. math.ceil(6 - t) .. "s" end
		if k >= 1 then
			stage = "pick"; bad = math.random(1, 5)
			tubes[bad].f.BackgroundColor3 = RED
			hint.Text = "Select the bad sample"
		end
	end)
end

-- ---------- 6. visual ----------
GAMES["Submit Scan"] = function(ctx)
	local a, W, H = ctx.area, ctx.W, ctx.H
	local info = ctx.info or {}
	ctx.hint("Stand still while the scanner reads you")
	local panelBox = stroke(corner(box(a, W / 2, H * 0.44, W * 0.8, H * 0.6, Color3.fromRGB(16, 40, 30), 52), 10), 2)
	local lines = {
		"ID: " .. tostring(info.name or "CREWMATE"), "HT: 3' 6\"", "WT: 92 lb", "C: " .. string.upper(tostring(info.suit or "?")), "BT: O-",
	}
	local rows = {}
	for i, s in ipairs(lines) do
		rows[i] = text(panelBox, W * 0.4, 12 + (i - 0.5) * (H * 0.56 / 5), W * 0.72, 24, s, 16, Color3.fromRGB(120, 255, 160), 53)
		rows[i].TextXAlignment = Enum.TextXAlignment.Left
		rows[i].Visible = false
	end
	local bar = stroke(corner(box(a, W / 2, H * 0.86, W * 0.7, 22, DEEP, 52), 11), 2)
	local fill = corner(box(bar, 0, 11, 0, 22, GREEN, 53), 11); fill.AnchorPoint = Vector2.new(0, 0.5)
	if info.scan then info.scan() end
	local t = 0
	ctx.tick(function(dt)
		t += dt
		local k = math.clamp(t / 6, 0, 1)
		fill.Size = UDim2.fromOffset(W * 0.7 * k, 22)
		for i, r in ipairs(rows) do r.Visible = k >= i / 6 end
		if k >= 1 then ctx.win() end
	end)
end

-- the fallback for anything without its own game: hold a button
GAMES.Default = function(ctx)
	local a, W, H = ctx.area, ctx.W, ctx.H
	ctx.hint("Hold the button")
	local b = button(a, W / 2, H * 0.45, math.min(W * 0.4, 240), math.max(MIN + 10, H * 0.25), "HOLD", YELLOW)
	local bar = corner(box(a, W / 2, H * 0.78, W * 0.6, 18, DEEP, 52), 9)
	local fill = corner(box(bar, 0, 9, 0, 18, GREEN, 53), 9); fill.AnchorPoint = Vector2.new(0, 0.5)
	local held, k = false, 0
	ctx.on(b.InputBegan, function(i) if isPress(i) then held = true end end)
	ctx.on(b.InputEnded, function(i) if isPress(i) then held = false end end)
	ctx.tick(function(dt)
		k = held and math.min(1, k + dt / 2) or math.max(0, k - dt)
		fill.Size = UDim2.fromOffset(W * 0.6 * k, 18)
		if k >= 1 then ctx.win() end
	end)
end

TP.LIST = {}
for name in pairs(GAMES) do if name ~= "Default" then table.insert(TP.LIST, name) end end
table.sort(TP.LIST)

function TP.open(area, taskName, info, finish)
	local ctx = { area = area, W = area.AbsoluteSize.X, H = area.AbsoluteSize.Y, info = info, conns = {}, alive = true, won = false }
	function ctx.on(sig, fn) table.insert(ctx.conns, sig:Connect(fn)) end
	function ctx.rel(i) return Vector2.new(i.Position.X, i.Position.Y) + TP.inset - area.AbsolutePosition end
	function ctx.tick(fn) ctx.on(RunService.RenderStepped, function(dt) if ctx.alive then fn(dt) end end) end
	function ctx.hint(s)
		return text(area, ctx.W / 2, ctx.H - 14, ctx.W - 20, 24, s, 15, Color3.fromRGB(190, 196, 210), 57)
	end
	-- drag: start(p), move(p), stop(p) with p in area pixels; one finger or the mouse at a time
	function ctx.drag(obj, start, move, stop)
		local active = nil
		ctx.on(obj.InputBegan, function(i)
			if active or not isPress(i) or not ctx.alive then return end
			active = i
			if start then start(ctx.rel(i)) end
		end)
		ctx.on(UIS.InputChanged, function(i)
			if not active or not isMove(i) then return end
			if active.UserInputType == Enum.UserInputType.Touch and i ~= active then return end
			if move then move(ctx.rel(i)) end
		end)
		ctx.on(UIS.InputEnded, function(i)
			if not active then return end
			if i ~= active and not (isPress(i) and i.UserInputType == active.UserInputType) then return end
			active = nil
			if stop then stop(ctx.rel(i)) end
		end)
	end
	function ctx.win()
		if ctx.won or not ctx.alive then return end
		ctx.won = true
		finish()
	end
	local build = GAMES[taskName] or GAMES.Default
	build(ctx)
	return function()
		ctx.alive = false
		for _, c in ipairs(ctx.conns) do c:Disconnect() end
		area:ClearAllChildren()
	end
end

return TP
