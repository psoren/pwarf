# CORE GAME LOOP
> Build this first. Nothing else gets added until this feels fun.

---

## The Loop

**Dig. Eat. Survive.**

That's it. The entire foundation of the game is the tension between expanding your fortress and keeping your dwarves alive long enough to do it.

---

## What Must Work Before Anything Else

### 1. Designate and Dig
The player can switch to dig mode, paint tiles on the local fortress map, and watch dwarves path to those tiles and excavate them in real time. The map updates as tiles are dug out. Stone gets hauled to a stockpile. The activity log reports it.

This must feel satisfying on its own. Watching a room take shape tile by tile is the first hook.

**It's working when:** You designate a 5×5 room, a miner walks over, and you watch it get carved out over the next minute or two of real time.

### 2. Needs Decay
Dwarves get hungry and thirsty over time. Needs tick down continuously. When food or drink need gets critical a dwarf drops what they're doing and goes to find some. If there's nothing to find, they get stressed. If it goes on long enough, they die.

The player needs to see this happening — the dwarf roster shows needs levels, color-coded. Yellow means watch out. Red means act now.

**It's working when:** You ignore your stockpile and watch a dwarf's food need slowly drain to zero, they get stressed, and eventually die. It should feel like your fault.

### 3. Farming
A farmer assigned to a farm plot will till soil, plant seeds, and eventually harvest food that goes into the stockpile. This is the only way to produce food indefinitely — embark supplies run out.

The core tension: farming takes time. You need to dig out a farm plot, assign a farmer, wait for a harvest. If you wait too long to start, your embark food runs out before the first harvest comes in.

**It's working when:** You start a fortress, realize your food is running low around day 20, frantically dig a farm plot and assign your farmer, and either make it to harvest in time or don't.

### 4. The Activity Log
The log reports everything in dense, slightly literary prose — exactly like DF's combat log. Every dig completion, every need going critical, every death. The player should be able to read the log and understand exactly what's happening without looking at anything else.

The log is how the game talks to the player. It needs to be good from day one.

**It's working when:** You can close your eyes, let the sim run for a minute, open them, read the log, and know exactly what happened.

---

## The Moment You're Chasing

> You start a fortress. Your 7 dwarves land on the surface with a few barrels of food and drink. You start digging. You get absorbed in laying out rooms. Then you check the roster and two dwarves are in the yellow on food. You look at the stockpile — 12 units left. You do the math. It's not enough. You frantically designate a farm plot, reassign your craftsdwarf to farming, watch the soil get tilled. The first seeds go in. The harvest timer starts. You check the food again — 6 units. Three dwarves in the red now. One of them stops working and wanders to the stockpile. There's nothing there. He sits down. The log says: *"Urist McRockbreaker has become very hungry."* Then: *"Urist McRockbreaker has died of starvation."* The harvest comes in two days later.

If that moment creates genuine tension — if you actually feel something — the foundation is solid.

---

## What Is Explicitly NOT In This Phase

Do not build any of the following until the core loop above is working and fun:

- Monsters or combat
- The world map
- Factions or trade caravans
- Expeditions or ruins
- The graveyard / publication mechanic
- Artifacts or strange moods
- Disease
- Nobles
- Multiple z-levels beyond basic up/down stairs
- Relationships or memories
- The legends log / world events

Each of these is a multiplier on top of the core loop. They make a fun game more fun. They cannot make a broken game fun.

---

## Milestone Checklist

The core loop is done when all of these are true:

- [ ] Player can designate tiles and dwarves execute dig orders in real time
- [ ] Dug tiles update on the map immediately
- [ ] Stone hauled automatically to nearest stockpile
- [ ] Dwarf needs decay continuously and are visible in the roster
- [ ] Dwarves autonomously seek food/drink when needs are low
- [ ] Dwarves die if needs hit zero
- [ ] Farm plots can be designated on soil tiles
- [ ] Assigned farmer tills, plants, and harvests on their own
- [ ] Harvested food goes to stockpile automatically
- [ ] Activity log reports all of the above in readable prose
- [ ] Fortress falls and fossilizes correctly when last dwarf dies
- [ ] The starvation scenario from TESTING.md passes
- [ ] The basic survival scenario from TESTING.md passes
- [ ] You can sit down and play it for 20 minutes and feel something

**Only when every box is checked do you move on.**

---

## What Comes Next (in order)

1. **Z-levels** — dig down, find different materials, hit the first cavern layer
2. **Basic combat** — soldiers, a single monster type, fight or die
3. **The world map** — your fortress on a tile, monsters approaching from outside
4. **Death and ruins** — fossilize, publish, graveyard

Each phase gets its own milestone checklist before moving to the next.
