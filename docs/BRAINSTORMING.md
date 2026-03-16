# BRAINSTORMING — DWARF FORTRESS CLONE
> Loose design thinking. Not final. Meant to be argued with.

---

## WHAT DO DWARVES ACTUALLY DO ALL DAY?

Each dwarf has a **job assignment** (or several) and spends their waking hours cycling through tasks that match those jobs. The sim doesn't micromanage individual steps — it resolves what a dwarf accomplished during the tick based on their skills, needs state, and available work orders.

### Core Jobs

**Miners**
The backbone of any fortress. Miners execute dig designations — the player paints tiles to be excavated and miners claim and execute them. A skilled miner digs faster, produces better-quality stone, and occasionally discovers gem veins or aquifers. An unskilled miner might accidentally breach an underground lake.

**Farmers**
Tend crop plots, harvest food, manage seed stocks. Farming output depends on soil quality (which varies by z-level and biome), season, and skill. A fortress with no farmers is on a timer — imported food runs out.

**Brewers / Cooks**
Convert raw food and plants into drink and prepared meals. Dwarves with unmet food/drink needs that go too long start stress-climbing fast. A good cook dramatically improves morale across the whole fortress. Masterwork meals are worth serious wealth.

**Craftsdwarves**
Execute work orders — furniture, crafts, mechanisms, containers. Output quality scales with skill. Exceptional and masterwork items contribute to fortress wealth and occasionally trigger artifact moods.

**Stonecutters / Masons**
Cut stone into blocks, construct walls and floors, build structures. Every construction project needs a mason to execute it.

**Woodcutters / Carpenters**
If the fortress tile has surface forest, woodcutters fell trees. Carpenters convert logs into furniture, barrels, bins. Fortresses without wood access have to trade for it or go without.

**Smiths (weaponsmith, armorsmith, metalsmith)**
Require a forge, fuel, and raw metal ore (from mining or trade). Produce weapons, armor, and metal goods. The highest-value output in the game. A legendary weaponsmith is a fortress asset worth protecting.

**Doctors / Healers**
Tend to injured dwarves — setting bones, cleaning wounds, applying splints. Without a doctor, injured dwarves either recover slowly on their own or die from infected wounds. A good doctor reduces the casualty count from monster encounters dramatically.

**Scholars / Scribes**
Produce books, maintain records, copy texts. Mostly a late-game morale/wealth play — a well-stocked library raises need_beauty and need_purpose for intellectual dwarves. Books can be traded, stolen by monsters, or recovered from ruins.

**Soldiers**
Assigned to a military squad. Train during peacetime (skill gain), respond to threats during sieges. A soldier who never fights gets bored and stressed. A soldier who fights too much without rest breaks down. The tension between training and readiness is a core management problem.

**Haulers**
No dedicated hauler job — every dwarf hauls when they have no other task. Moving items from where they were produced/dropped to where they're stored. This is the hidden bottleneck of every fortress. A fortress where everyone is a specialist and nobody hauls grinds to a halt.

---

### Dwarf Autonomy

Dwarves aren't purely task-executing robots. Between assigned jobs they:

- **Socialize** — seek out friends, which raises need_social and can form/strengthen relationships
- **Pray** — if religiously devoted, seek out a shrine or temple structure. Unfulfilled religious devotion raises stress.
- **Admire fine things** — walking past a masterwork statue or well-crafted furniture briefly boosts need_beauty
- **Eat and drink** — autonomously seek food/drink when needs drop below a threshold
- **Sleep** — find a bed or sleep on the floor if none available (floor sleep raises stress)
- **Brood** — a stressed dwarf who can't socialize or find beauty may just stand somewhere and spiral
- **Tantrum** — at high enough stress, a dwarf destroys objects, attacks other dwarves, or collapses. Tantrums are contagious. A cascade can topple a fortress faster than any siege.

---

## AN AVERAGE SESSION IN A FORTRESS (real-time narrative)

The sim runs in real time at ~10 steps/second. One in-game year = 30 real minutes. One in-game day = ~5 real seconds. Here's what playing actually feels like:

**Pacing reference:**
- A stone door takes a mason maybe 3 in-game days to complete = ~15 real seconds of watching
- A dig designation through granite takes an unskilled miner ~2 in-game weeks = ~1.5 real minutes
- A forgotten beast traveling 3 world-map tiles to reach you takes ~3 in-game months = ~7 real minutes of mounting dread
- A full growing season (spring to harvest) = ~4 real minutes
- A dwarf's entire lifespan (~80 years) = ~40 real hours of play

**What a session looks like:**

Imagine it's year 14 of the fortress Koganusan, population 23. The player sits down for an hour — that's about 2 in-game years.

They open the log. Last session ended with a forgotten beast spotted 3 tiles out. It's now 1 tile away — maybe 7 real minutes until it arrives. The player has time to react but not to panic.

They pull up the dwarf roster. Urist McRockbreaker has need_drink in the yellow — he's been mining nonstop and hasn't stopped to drink. He's not critical yet but will be in a few in-game hours (~30 real seconds). The player doesn't need to do anything — Urist will break for the stockpile autonomously when it gets bad enough. But a player paying attention can reassign him to a job closer to the barrels.

The mason finishes a stone door in real time — the player sees the log entry pop: *"Urist McStonecutter has completed a stone door."* Wealth ticks up. The craftsdwarf is working on trade goods — the player can watch the progress bar on their work order advance.

The military squad is drilling in the barracks. The player can see their XP climbing in real time. Meng Lorbamzulban is close to tipping from Adequate to Competent — satisfying to watch happen.

Then the log fires: *"The forgotten beast Aba Othosp Zefon has arrived at Koganusan."* The ASCII viewport shows it entering from the map edge — a capital B in red. The player hits the alert key to lock dwarves inside. Soldiers start pathing toward the breach. This is the game.

**Yearly rollup** happens silently every 30 real minutes — dwarves age, skills level up, immigrants may arrive, ruins decay. The player will notice a log burst: several events firing at once marking the new year.

---

## HOW DOES A CIVILIZATION START?

### Embark

The player picks a tile on the world map. Not all tiles are equally good — terrain type affects what resources are available, biome tags affect farming, elevation affects how deep you can dig before hitting water or magma. Haunted and evil biomes are harder but have unique resources.

Before confirming, the player sees a tile summary:
- Terrain type and biome tags
- Surface resources (trees, soil, ore veins visible at surface)
- Nearby threats (known monsters, hostile faction territory)
- Nearby ruins (potential early expedition targets)
- Whether another player's active fortress is nearby (could be ally or threat later)

The player names their civilization and picks a **profile** — a starting skill distribution across their initial 7 dwarves. Classic DF style. A miner-heavy embark hits the ground digging. A military embark starts with trained soldiers but weak production.

### Starting Conditions

Every civilization begins with:
- 7 dwarves with skills matching the chosen embark profile
- A small supply of food, drink, seeds, and basic tools (an embark kit)
- No structures, no dug tiles — just a surface camp on their world tile
- Year 0, wealth 0, population 7

The first few ticks are the most dangerous. No shelter means dwarves sleep outside (stress penalty). No farms means embark food runs out in ~10 ticks. No defenses means any wandering monster threat is immediately dangerous.

The embark kit should be enough to survive about 15 in-game days (~75 real seconds) if the player does nothing — but barely. Get farming going fast.

---

## CAN YOU EXPAND PAST YOUR ORIGINAL TILE?

This is a big question. Here's the thinking:

### Option A: Hard no — one tile forever
Simple. The fortress is deep, not wide. You dig down through z-levels and that's your expansion axis. Your 20×20 (or whatever) footprint is fixed — you just go deeper. This is actually how DF works and it creates interesting constraints. You can't spread out, so you optimize vertically.

**Pros:** Simple to implement, clean world map (each tile = exactly one fortress), no border disputes between players.
**Cons:** Might feel limiting once players get deep into the game.

### Option B: Claim adjacent tiles via expeditions
Instead of expanding your live fortress, you send expeditions to adjacent tiles to establish **outposts** — smaller secondary sites that feed resources back to the main fortress. The outpost isn't a full fortress sim, just a resource extraction node. It has a handful of assigned dwarves, a simple production job (logging camp, mine, farm annex), and contributes to your stockpiles each tick.

Outposts can be overrun by monsters independently of the main fortress. Losing an outpost hurts but doesn't kill you.

**Pros:** Natural expansion mechanic, creates interesting strategic map presence, gives players something to do with excess population.
**Cons:** More complex to sim, outposts need their own threat/defense logic.

### Option C: Hybrid — dig bleeds into adjacent tiles underground
Your surface footprint stays fixed at your world tile, but if you dig deep enough you can tunnel into the underground of adjacent tiles. Underground expansion is invisible on the world map — other players can't see it. You could tunnel into a ruin's basement, access an ore vein under a mountain tile, or connect to another player's tunnel system accidentally.

**This is the most interesting option** and the most DF-flavored. The surface world is tidy — one tile, one fortress. But underground is a secret expanding web.

**Recommendation: Option A for launch, design Option C as a later feature.** Don't block it architecturally.

---

## HOW DOES EXCAVATION WORK?

### The Designation System

The player switches to **Dig Mode** on the local fortress map. They paint tiles to be excavated — single tiles, rooms, or flood-fill areas. Painted tiles get a designation marker (an overlay glyph, say `x`).

Miners see open dig designations and claim them. Each claimed tile takes some number of sim steps to excavate based on:
- The miner's skill level
- The material being dug (soil is fast, granite is slow, adamantine is very slow)
- Whether the miner has the right tools

When a tile is dug out it becomes a floor tile, and the stone/ore it contained goes to a stockpile (or drops on the floor if no stockpile space is available — and floor clutter is a morale penalty).

### Z-Levels

The fortress map has multiple vertical layers. Players navigate between them with `<` and `>`. Digging down requires designating a staircase or ramp — you can't just mine straight down into void.

Z-level navigation:
- `▲` = staircase up, `▼` = staircase down, `X` = up/down staircase (connects both)
- Ramps allow dwarves and haulers to move items between levels without stairs
- Collapsing a staircase is how you seal off a compromised lower level in an emergency

### What You Find When You Dig

The world tile has a geology that was generated at world-gen time (stored in `biome_tags` and `properties` on the world tile row). As you dig deeper you pass through layers:

**Surface (z+3 to z+0):** Soil, clay, sand depending on biome. Easy to dig, bad for building. Good for farming plots.

**Shallow stone (z-1 to z-10):** Sedimentary rock — limestone, sandstone, mudstone. Medium dig speed. Ore veins start appearing here (iron, copper, tin).

**Deep stone (z-11 to z-25):** Igneous and metamorphic — granite, basalt, obsidian. Slow to dig, extremely strong building material. Rare ore veins (silver, gold, gems).

**Cavern layer 1 (z-15 to z-20):** First underground wilderness layer. Natural open spaces, underground lakes, cave flora, cave creatures. Breaking into it is a milestone moment. Monsters start spawning from caverns.

**Cavern layer 2 (z-30 to z-40):** Deeper, more dangerous. Forgotten beasts lair here. Rare minerals.

**Magma sea (z-50+):** Extreme danger. Magma flows — breach it accidentally and you flood lower levels. Intentionally tap it for infinite fuel source. Very late game.

**HFS (Hell / Fun Stuff) (z-80+):** If we go there. Classic DF feature. Optional feature flag.

### Breaching Events

Certain dig outcomes are events, not just terrain changes:

- **Aquifer breach** — water floods the level. Emergency response required or lower levels drown. Manageable with pumps but only if you have them.
- **Cavern break-in** — the tile opens into a natural cavern. Creatures from the cavern can now path into your fortress. You need to wall it off or defend the breach.
- **Gem vein discovery** — a rich deposit is found. Fires a world_events log entry. High wealth gain over next few ticks as miners extract it.
- **Forgotten beast emergence** — digging too deep wakes something. It begins pathing toward the surface. At real-time sim speed you have several real minutes of warning — enough to see it in the log and prepare, not enough to be casual about it.
- **Magma breach** — catastrophic if accidental. Magma flows upward and laterally. Dwarves in the path die within seconds of real time. Structures melt. Can destroy a fortress in under a real minute if not contained.

### Smoothing and Engraving

After a tile is excavated, dwarves can **smooth** the walls (removes rough stone texture, adds value) and then **engrave** them (adds a scene or pattern, high value, raises need_beauty for dwarves who pass by). Engraved walls are worth wealth. A fortress with engraved dining halls and bedrooms has dramatically better morale than a bare-stone dungeon.

Engraving content is procedurally generated from the fortress's history — a dwarf who survived a monster siege might engrave a scene of the battle. This feeds back into the legends system.

---

## OTHER THINGS WORTH FIGURING OUT LATER

- **Artifacts** — a dwarf enters a strange mood, claims a workshop, demands materials, and produces a legendary item. The item goes into the world permanently. It has a name, a description, a creator. It can be traded, stolen, looted from your ruin. It persists in the DB forever.
- **Nobles** — as population grows, noble positions emerge (sheriff, mayor, baron). Nobles make demands. Failing to meet demands causes unhappiness. Meeting them costs resources. Nobles are a resource drain that scales with success.
- **Immigration waves** — every few ticks, a wave of migrants arrives if your fortress has a good reputation (wealth, legends, artifacts). More dwarves = more labor but also more mouths and more potential for tantrum cascades.
- **Taverns and temples** — built structures that satisfy need_social and need_beauty passively. Taverns attract visitors (including spies). Temples reduce stress for religious dwarves.
- **Ghosts** — a dwarf who dies without a proper burial becomes a ghost. Ghosts haunt the fortress, terrifying living dwarves (stress penalty). You have to engrave a memorial slab to put them to rest. A fortress that falls with many unburied dead becomes a very haunted ruin.