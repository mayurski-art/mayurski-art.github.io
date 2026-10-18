-- Bots (ModuleScript under TrollUsServer): Crewmate and Impostor bots for Play Solo rounds and empty seats.
-- The server owns everything; bots only call the api it hands to init (kill, report, taskDone, fix, sabotage).
local RunService = game:GetService("RunService")
local PathfindingService = game:GetService("PathfindingService")

local Bots = {}
local api

local function roomAt(pos)
	for _, r in ipairs(api.Map.Rooms:GetChildren()) do
		local s, c = r.Size, r.Position
		if math.abs(pos.X - c.X) <= s.X / 2 and math.abs(pos.Z - c.Z) <= s.Z / 2 then return r.Name end
	end
	return nil
end

local function stateOf(p)
	p.bot = p.bot or { path = nil, wp = 1, goal = nil, busyUntil = 0, doing = nil, think = 0, stuckAt = 0, stuckPos = nil, stuck = 0 }
	return p.bot
end

-- what the bot is up to, readable from Studio (Explorer or execute_luau) while testing
local function say(p, text)
	if p.model and p.model:GetAttribute("BotState") ~= text then p.model:SetAttribute("BotState", text) end
end

local function stop(p, b)
	b.path, b.goal, b.computing = nil, nil, false
	local hum, hrp = api.humOf(p), api.hrpOf(p)
	if hum and hrp then hum:MoveTo(hrp.Position) end
end

-- path to pos; falls back to a straight MoveTo when pathfinding fails
local function goTo(p, b, pos)
	if b.goal and api.flat(b.goal, pos) < 1.5 and (b.path or b.computing) then return end
	b.goal, b.path, b.wp = pos, nil, 1
	local from = api.posOf(p)
	if not from then return end
	b.computing = true
	local myGoal = pos
	task.spawn(function()
		local path = PathfindingService:CreatePath({ AgentRadius = 1.8, AgentHeight = 5, AgentCanJump = false, WaypointSpacing = 4 })
		local ok = pcall(function() path:ComputeAsync(from, Vector3.new(myGoal.X, from.Y, myGoal.Z)) end)
		if b.goal ~= myGoal then return end
		b.computing = false
		if ok and path.Status == Enum.PathStatus.Success then
			b.path = path:GetWaypoints()
		else
			b.path = { { Position = myGoal } }
		end
		b.wp = math.min(2, #b.path)
		b.stuckAt, b.stuckPos = api.now(), from
	end)
end

local function arrived(p, b, pos, r)
	local here = api.posOf(p)
	return here and api.flat(here, pos) <= (r or 2.5)
end

local function randomPad()
	local ids = {}
	for id in pairs(api.Pads) do table.insert(ids, id) end
	return api.Pads[ids[math.random(#ids)]]
end

-- ---------- crewmate ----------
local function thinkCrew(p, b, idx)
	local now = api.now()
	local pos = api.posOf(p)
	if not pos then return end

	if p.alive then
		for _, body in ipairs(api.Bodies:GetChildren()) do
			if api.flat(body:GetPivot().Position, pos) <= 12 then
				stop(p, b)
				api.report(p)
				return
			end
		end
	end

	local s = api.S.sabotage
	if s and p.alive then
		local pads = {}
		for _, f in ipairs(api.Map.FixPads:GetChildren()) do
			if f:GetAttribute("Kind") == s.kind and not f:GetAttribute("Fixed") then table.insert(pads, f) end
		end
		if #pads > 0 then
			local pad = pads[(idx % #pads) + 1]
			say(p, "fixing " .. s.kind)
			if arrived(p, b, pad.Position, api.R("useRange") - 1) then
				stop(p, b)
				api.fix(p, pad)
			else
				goTo(p, b, pad.Position)
			end
			b.doing = nil
			return
		end
	end

	if b.doing then
		say(p, "doing " .. tostring(b.doing))
		if now >= b.busyUntil then
			api.taskDone(p, b.doing)
			b.doing = nil
		end
		return
	end

	for i, t in ipairs(p.tasks) do
		if not t.done then
			local pad = api.Pads[t.id]
			-- stuck three times on this task: put it at the back of the list and try the next
			if b.stuck >= 3 then
				b.stuck = 0
				table.remove(p.tasks, i)
				table.insert(p.tasks, t)
				b.goal, b.path = nil, nil
				return
			end
			if arrived(p, b, pad.Position, 3) then
				stop(p, b)
				b.doing = t.id
				b.busyUntil = now + api.R("botTaskTime")
				b.stuck = 0
			else
				say(p, ("to %d %s/%s%s"):format(t.id, pad:GetAttribute("Room"), pad:GetAttribute("Task"), b.computing and " (pathing)" or ""))
				goTo(p, b, pad.Position)
			end
			return
		end
	end

	-- all done: drift between rooms
	say(p, "all done, wandering")
	if not b.goal or arrived(p, b, b.goal, 3) then goTo(p, b, randomPad().Position) end
end

-- ---------- impostor ----------
local SABOTAGES = { "Lights", "Lights", "Comms", "Reactor", "O2" }

local function loneTarget(p, pos)
	local best, bd = nil, 26
	for _, q in ipairs(api.list()) do
		if q.alive and q.role ~= "Impostor" then
			local qp = api.posOf(q)
			if qp and api.flat(qp, pos) < bd then
				local alone = true
				for _, w in ipairs(api.list()) do
					if w ~= q and w ~= p and w.alive and w.role ~= "Impostor" then
						local wp = api.posOf(w)
						if wp and api.flat(wp, qp) < 20 then alone = false; break end
					end
				end
				if alone then best, bd = q, api.flat(qp, pos) end
			end
		end
	end
	return best
end

local function thinkImpostor(p, b)
	local now = api.now()
	local pos = api.posOf(p)
	if not pos or p.venting then return end

	if p.alive and now >= p.killReady then
		local target = loneTarget(p, pos)
		if target then
			say(p, "hunting " .. target.name)
			local tp = api.posOf(target)
			if api.flat(tp, pos) <= api.R("killRange") - 0.5 then
				stop(p, b)
				api.kill(p, target)
				b.doing = nil
				goTo(p, b, randomPad().Position) -- walk away from the body
			else
				b.goal = nil -- re-path toward the moving target
				goTo(p, b, tp)
			end
			return
		end
	end

	if not api.S.sabotage and now >= api.S.sabotageReady and math.random() < 0.012 then
		api.sabotage(SABOTAGES[math.random(#SABOTAGES)])
	end

	-- fake tasks: stand at a pad for a few seconds, then move on
	say(p, b.doing and "faking a task" or "walking")
	if b.doing then
		if now >= b.busyUntil then b.doing = nil; b.goal = nil end
		return
	end
	if b.goal and arrived(p, b, b.goal, 3) then
		stop(p, b)
		b.doing = true
		b.busyUntil = now + 2 + math.random() * 3
		return
	end
	if not b.goal then goTo(p, b, randomPad().Position) end
end

-- ---------- loop ----------
local function step(dt)
	local S = api.S
	local idx = 0
	for _, p in ipairs(api.list()) do
		if p.isBot and p.model and p.model.Parent then
			idx += 1
			local b = stateOf(p)
			local hrp, hum = api.hrpOf(p), api.humOf(p)
			if hrp and hum then
				-- face the camera, leaning toward the walk direction
				local ao = hrp:FindFirstChild("Face")
				if ao then
					local v = hrp.AssemblyLinearVelocity
					local yaw = math.clamp(v.X / 12, -1, 1) * 0.55
					ao.CFrame = CFrame.Angles(0, math.pi + yaw, 0) -- same facing rule as the player
				end

				if S.phase ~= "Roam" then
					if b.path or b.goal or b.doing then stop(p, b); b.doing = nil end
				else
					-- follow waypoints
					if b.path and b.wp <= #b.path then
						local target = b.path[b.wp].Position
						if api.flat(hrp.Position, target) < 2.2 then
							b.wp += 1
						else
							hum:MoveTo(Vector3.new(target.X, hrp.Position.Y, target.Z))
						end
						-- stuck: barely moved in 3 s, try again
						if api.now() - b.stuckAt > 3 then
							if b.stuckPos and api.flat(b.stuckPos, hrp.Position) < 1 then b.goal = nil; b.path = nil; b.stuck += 1 end
							b.stuckAt, b.stuckPos = api.now(), hrp.Position
						end
					elseif b.path and b.goal and api.flat(hrp.Position, b.goal) > 3 then
						-- ran out of waypoints short of the goal: drop the path so the next think re-paths
						b.path, b.goal = nil, nil
					end
					b.think -= dt
					if b.think <= 0 then
						b.think = api.R("botThinkInterval") + math.random() * 0.2
						b.room = roomAt(hrp.Position) or b.room
						if p.role == "Impostor" then thinkImpostor(p, b) else thinkCrew(p, b, idx) end
					end
				end
			end
		end
	end
end

function Bots.init(a)
	api = a
	RunService.Heartbeat:Connect(function(dt)
		local ok, err = pcall(step, dt)
		if not ok then warn("[TrollUs bots] " .. tostring(err)) end
	end)
end

-- ---------- meetings ----------
local function aliveOthers(p, list, skipImpostors)
	local out = {}
	for _, q in ipairs(list) do
		if q ~= p and q.alive and not (skipImpostors and q.role == "Impostor") then table.insert(out, q) end
	end
	return out
end

function Bots.pickVote(p, list)
	for id in pairs(p.sus or {}) do
		for _, q in ipairs(list) do
			if q.id == id and q.alive then return id end
		end
	end
	if p.role == "Impostor" then
		local pool = aliveOthers(p, list, true)
		if #pool > 0 and math.random() < 0.5 then return pool[math.random(#pool)].id end
		return "skip"
	end
	local pool = aliveOthers(p, list, false)
	if #pool > 0 and math.random() < 0.25 then return pool[math.random(#pool)].id end
	return "skip"
end

local FILLER = { "where?", "who?", "I was doing tasks", "skip unless someone saw something", "anyone?", "no info, skip", "sus" }

function Bots.meetingLines(caller, kind, everyone)
	local lines = {}
	local t = 1.5
	local function add(p, text) t += 1 + math.random() * 2.5; table.insert(lines, { t = t, p = p, text = text }) end
	if caller.isBot then
		local room = caller.bot and caller.bot.room
		if kind == "Body" then add(caller, room and ("body in " .. room) or "I found a body")
		else add(caller, "emergency meeting, talk") end
	end
	for _, p in ipairs(everyone) do
		if p.isBot and p.alive and p ~= caller then
			local accused
			for id in pairs(p.sus or {}) do
				for _, q in ipairs(everyone) do if q.id == id and q.alive then accused = q end end
			end
			if accused then
				add(p, "it was " .. accused.name .. ", I saw it")
			elseif math.random() < 0.6 then
				local room = p.bot and p.bot.room
				if room and math.random() < 0.6 then add(p, "I was in " .. room)
				else add(p, FILLER[math.random(#FILLER)]) end
			end
			if p.role == "Impostor" and math.random() < 0.3 then
				local pool = aliveOthers(p, everyone, true)
				if #pool > 0 then add(p, pool[math.random(#pool)].name .. " is sus") end
			end
		end
	end
	return lines
end

return Bots
