# TROLLS on the operator: the vision

Status: APPROVED 2026-10-11 (decisions at the end). Nothing in the game
uses any of this yet; the #1718 head art and preview live in the
`tf-traits` worktree, uncommitted. Next: phase 1, the tank top.

## The idea in one paragraph

The playable troll wears the traits of the TROLLS NFT it belongs to
(opensea.io/collection/trollsoneth: 3333 tokens, 217 traits over five types:
HATS, FACIALS, EYES, CLOTHES, BACKGROUND, plus a few 1-of-1 ALPHAs). Only
the wallet that owns a token gets to wear that token's exact look, so in a
lobby a TROLLS holder is recognisable at a glance as *that* troll. Every
trait is drawn once and reused, so each new trait finished unlocks every
token that has it; whole looks fill in as the library grows.

## Settled by the user

- **Drawn, not modelled.** The 3D Blender attempt was rejected ("this
  looks horrible"). Traits are flat drawings in the game's own ink style
  on the live stick figure. The Blender files stay in the repo for later.
- **The stick figure stays.** Clothes are fitted to it: a garment gives the
  figure a body only where the garment is ("stick figure but the outfit
  should be fitted"). Arms and legs stay ink lines.
- **The unit is the token.** You wear token #N's full combination, not a
  mix-and-match of traits.
- **First token: #1718** (Goatfarm Hat "U MAD BRO?", French Moustache, Tank
  Runner, Eyes Relaxed, Stone). It's literally the Troll Runner.
- **The back of the head is not a face.** Seen from behind: a plain white
  skull with an ink rim, and the back of whatever the hat is.
- **No face colours.** The trollface is always the white OG art. Traits
  sit on it or around it, never recolour it.

## The look: rules every trait follows

1. **It's the same world as the face board.** The head is a flat board
   that goes edge-on from the side, and so is every trait. No trait gets
   more depth than the head it sits on.
2. **Ink and flat fill.** Black ink outline (the body line's 0x050505),
   flat colours lifted from the NFT image, at most one shade per colour.
   No gradients, no rendered shading, nothing that reads as plastic.
3. **Traced from the NFT, then simplified.** Shapes, proportions and
   lettering come from the token's own image (the rule for guns, applied
   here): if it doesn't read as *that* hat, it's wrong. Then thicken the
   lines and drop detail until it reads from 20 m in third person.
4. **Front and back.** A trait that shows from behind (hats, clothes) has
   a drawn back view; one that doesn't (moustache, eyes) is front only.
5. **Rides a joint, never animates on its own.** A hat is glued to the head
   pivot, a shirt to the torso joints. The new gait, lean, follow-through
   and hit stagger move them for free.
6. **Cosmetic only.** No trait changes a hitbox, a speed or a sound. A tall
   hat poking over cover is the wearer's own risk.

## What each trait type becomes

| Type | In game | Where it lives | Status |
|---|---|---|---|
| HATS | drawing on the head frame, front + back | `headPivot` | Goatfarm drawn |
| FACIALS | drawing on the head frame, front only | `headPivot` | French Moustache drawn |
| EYES | painted into the face texture (the bandana path, so it follows expressions) | face material | Relaxed = the OG art, nothing to draw |
| CLOTHES | a fitted garment board on the torso, front + back; the arms start at its armholes | `torso` + `chest` joints | Tank Runner next |
| BACKGROUND | not used: nothing to wear | none | skipped (user) |
| ALPHA 1-of-1s | hand-built specials, last | anywhere | later |

The head frame is fixed: a 1000×1033 SVG = headPivot x -0.30..0.30 m,
y 0.62..0 m, with the face art at (100, 233.3) sized 800×750. Every head
trait is drawn in it, so they all line up with each other and the face.

## The hard part: clothes on a stick

The NFT trolls have white bodies with shoulders, a neck and a chest. Our
operator has none of that: one ink spine, and both arms leave a single
point at the top of it (no shoulder width). A tank top drawn the NFT's way
has armholes where our figure has no arms.

The garment board idea: a flat drawn cut-out of the garment, thin like the
head (a few cm of edge in ink, drawing on both faces), split at the spine
joint so it bends with the lean. Inside the openings it shows white "skin"
(neck, upper chest) like the NFT does, so the troll gets a body exactly
where the clothes are. What changes between the options is the arms:

- **A. Shoulders only when clothed.** A clothed rig's arms start ~9 cm
  either side of centre, at the garment's armholes. Reads most like the
  NFT. Costs: the two-handed gun hold, throws, emotes and the arm IK all
  need retuning for a second arm origin; the bare stick look is unchanged.
- **B. Keep one arm point, draw around it.** The garment is drawn narrow
  at the top (a vest/sash silhouette that meets the arm point), the arms
  leave its top corner. Nothing in the animation changes. Reads less like
  the NFT, more like a stick figure wearing a bib.
- **C. Front panel only.** Just the printed part (the lime "RUNNER" band)
  as a patch on the spine line. Cheapest, least like the NFT.

**Chosen: A** (user, 2026-10-11). The tank top is the one thing that makes
#1718 read as the NFT and not as a stick figure in a hat, and the
arm-origin work is a one-time cost every later garment reuses. A bare
troll keeps the single arm point.

## Who wears it

- **Picking:** a TROLLS section in Cosmetics. You connect your wallet,
  enter a token number it owns (the contract can't list a wallet's tokens,
  so a "show my trolls" list needs an indexer: a nice-to-have), and the
  locker shows that troll. Holder-only from day one.
- **Proof:** connect an Ethereum wallet (MetaMask etc., `window.ethereum`),
  read `ownerOf(token)` from a public RPC, sign a one-off message. Saved
  with cosmetics (`trollops:cosmetics`, already cloud-synced) and
  re-checked daily. The netcode trusts the client, so this is honest-client
  gating, same as everything else in the game.
- **Others see it:** the token number rides the state packet next to `fc`
  (a few bytes); every client draws that token's look from the shared
  trait files. Bots never wear tokens.
- **Untraced traits:** if a token has a trait we haven't drawn yet, that
  slot stays bare (and the locker says which ones are coming).

## How it fits with what's already there

- **Bandanas** (face covering) and **facials** both sit on the lower face:
  a covering hides the facial while it's on.
- **Expressions** (sad emote) and **eyes** traits: eyes are painted into the
  face texture, so they change with the face, the way bandanas already do.
- **Watches and club wristbands**: untouched, they're on the hands.
- **Cop and hero bodies** (Troll City RP, U Mad Bro?): they replace the
  stick figure, so traits hide under them. Cop bodies already hide every
  head cosmetic; hero bodies need the same one line.
- **Back of the head**: the board goes front-facing only and gets the
  skull back (already working in the preview).

## Building it

- **Art:** one SVG per trait in `traits/src/` (head frame, or the garment
  frame once decision 1 is made), `<id>.back.svg` where there's a back.
  `tools/troll-ops-bake-traits.mjs` bakes them to PNGs (lettering baked to
  pixels). The trait id is the on-chain name slugged with its type:
  `hat-goatfarm`, `facial-french-moustache`, `clothes-tank-runner`.
- **Registry:** `traits/trollsoneth.json`, token → its five trait names
  (built once from the collection metadata), plus which trait ids are
  drawn. `traits.js` (new, owns it): `applyToken(rig, id)` puts on every
  drawn trait and reports the rest.
- **In game:** trait planes on the joints, one shared texture per trait,
  so 30 trolls in a lobby cost 30 small meshes and a handful of textures.
- **Order after #1718:** by how many tokens a trait completes, rarity
  weighted, so whole looks unlock fastest. Hats and facials first (head
  frame is ready), clothes once their frame is proven on #1718.

## Phases

1. **#1718 complete in the preview**: hat, moustache (done), the tank top
   on its garment board with shoulders (the arm origin moved for a clothed
   rig, gun hold and throws retuned in the preview first), eyes slot proven
   with one non-OG eye. You sign off on the look.
2. **In the game, holder-only**: `traits.js`, the board going front-only
   with the skull, the clothed arm origin in character.js (gun hold, throws,
   emotes checked by their tests), the token on the wire, wallet connect,
   `ownerOf` check, signed proof, and the TROLLS picker locked to your
   tokens. Nothing ships until the ownership check does. Targeted tests,
   then a gate.
3. **The library**: trait by trait, most-worn first. Each is a drawing plus
   a bake; no code.

## Decisions taken (user, 2026-10-11)

1. **Clothes:** A, shoulders when clothed.
2. **BACKGROUND:** skipped.
3. **Early access:** none. Holder-only from day one; the in-game part ships
   with the ownership check.
4. **Rights:** cleared to use the TROLLS art.
