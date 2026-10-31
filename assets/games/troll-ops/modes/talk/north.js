/* North, Kabukigrin's head bartender (docs/NPC-DIALOGUE.md section 8).
   Dry, quick, has seen every kind of drunk, likes you a little more than he
   lets on. Data only: modes/npc-dialogue.js walks it.

   "What'll it be?" is the bar's door (service "bar"): the bar session
   registers it; until then North says `fallback`. */

export default {
  id: "north",
  name: "North",
  role: "Head bartender",
  greet: [
    { if: "owner", say: "Boss. Your end of the bar's wiped.", set: "met" },
    { if: "tipsy", say: "You're swaying. I'm not. Let's keep it that way.", set: "met" },
    { if: "met", say: ["Back already? The stools missed you.", "You again. Good. Quiet night."] },
    { say: "New face. I'm North. Bar's open, mouth's optional.", set: "met" },
  ],
  hub: "main",
  nodes: {
    main: {
      say: ["Anything else?", "What else?", "Go on."],
      options: [
        { text: "What'll it be?", to: "order" },
        { text: "Who are you?", to: "who" },
        { text: "What is this place?", to: "place" },
        { text: "Heard anything?", to: "rumour" },
        { text: "Later.", bye: true, say: ["Tip your bartender. Emotionally.", "Mind the step. Everyone misses the step."] },
      ],
    },

    order: {
      service: "bar",
      say: "Name your poison.",
      back: "Actually, nothing.",
      backSay: "Bold choice. Water's free.",
      fallback: "Taps are getting rewired. Ask me in a minute.",
    },

    who: {
      say: "North. I point drinks the right way.",
      set: "askedWho",
      options: [
        { text: "Why North?", to: "who", say: "Never lost a tab. Never lost a customer. Lost a few teeth." },
        { text: "Seen it all?", to: "who", say: "Seen a guy propose to the koi tank. So, yes." },
        { text: "Back to it.", to: "main", say: "Right." },
      ],
    },

    place: {
      say: "Kabukigrin. Grinjuku's loudest block with a club stapled on.",
      options: [
        { text: "Who runs it?", to: "place", say: "Big Boss. Office over the floor, one-way glass. He sees your dancing. Sorry." },
        { text: "The koi?", to: "place", say: "VIP tank. Don't tap the glass. They bill you per tap." },
        { text: "The DJ?", to: "place", say: "DJ Lulz. Takes requests. Plays his own. Ask anyway." },
        { text: "Outside?", to: "place", say: "Tako stall, konbini, pachinko. The metro under it never sleeps." },
        { text: "VIP's nice.", to: "place", if: "vip", say: "Course it is. You paid for the carpet." },
        { text: "Back to it.", to: "main", say: "Right." },
      ],
    },

    rumour: { pick: ["r1", "r2", "r3", "r4", "r5"], unseen: true, empty: "dry" },
    r1: { say: "When the bass drops in VIP, it rains money. Don't ask whose." },
    r2: { say: "Someone keeps lighting green candles on stage. Chart people. Harmless. Mostly." },
    r3: { say: "Guy in the bandana got bounced four times tonight. Personal best." },
    r4: { say: "Last train in Undergrin? Never leaves. Don't wait for it." },
    r5: { say: "Big Boss counts the till twice. Counts me three times." },
    dry: { say: "That's all I've got. Buy something and I'll remember more." },
  },
};
