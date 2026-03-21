# Food & Water Survival Brainstorm

> Loose design thinking. Meant to be argued with.

---

## The core problem

Right now dwarves die constantly because there's no viable food/water loop. The sim has the _skeleton_ (needs decay, need-satisfaction phase, auto-brew/cook phases) but the flesh is missing:

- No drink items at embark → dwarves immediately enter thirst crisis
- `findNearestWaterSource` checks wells and inventory `drink` items, but ignores pond tiles entirely → if you don't build a well fast enough, there's no fallback
- Embark creates placeholder items (bug #488) that probably don't satisfy needs
- Construction is slow → well takes forever to build → dwarves die before it completes

The result: every game ends in a death spiral in the first few minutes. Not fun.

---

## Water

### Immediate: pond drinking

Dwarves should be able to drink directly from a pond tile. This is the obvious fallback — if there's water on the map, dwarves shouldn't die of thirst.

- `findNearestWaterSource` should scan `state.tiles` for `type === 'pond'` (or `'water'`) and return the nearest one when no well or drink items are found
- Dwarf walks to the tile edge and drinks. No container needed.
- Could add a small thought: "Drank from muddy water" with mild stress penalty (it's not ideal, just survivable)
- Pond drinking is slower than using a well (have to walk there, drink, walk back) — incentivizes building a well eventually

### Medium: water containers / bottles

Dwarves could carry water in bottles/barrels:

- New item type: `water_bottle` (filled) / `empty_bottle`
- Dwarves assigned a "fill containers" job go to pond, fill bottle, haul back to stockpile
- Other dwarves drink from stockpiled bottles (satisfies need_drink, removes item)
- Bridges the gap between "pond on the map" and "well built and staffed"

### Long-term: well + buckets

Wells are already in the schema. The current issue is just that:
1. They take too long to build
2. Even once built, there needs to be a bucket/hauling loop to actually use them

DF does this as: dwarf takes bucket → goes to well → fills bucket → returns bucket to "ready" state. We could simplify: well just acts as an infinite drink source (like it currently does in the code), no bucket needed. That's fine for now.

---

## Food

### Immediate: real starting food at embark

Dwarves should start with actual food items, not placeholder strings. Even just 5–10 `dried_meat` or `travel_ration` items in the starting inventory. This buys time for farming to come online.

Fix for bug #488 — embark item generation needs to produce real `Item` objects with `category: 'food'` (and `category: 'drink'` for ale/water).

### Short-term: foraging

Before farming is up, dwarves should be able to forage for food:

- Map tiles could have `forageable: true` (surface grass/forest tiles)
- Foraging job: dwarf walks to a forageable tile, spends a tick, produces 1 `wild_mushroom` or `berries` food item
- Low yield, but nonzero — keeps fortress alive while farm is set up
- Skill: novice forager takes 3 ticks, expert takes 1

### Short-term: hunting

If monsters spawn on the surface, a soldier/hunter could kill them and butcher the corpse for meat. We already have combat. Just need:
- Butchering task triggered on dead monster
- Meat items added to inventory

### Medium: farming loop

The farming pipeline exists (farm plots → harvest → cook). The issue is probably throughput:
- Farm plots need to be designated
- Seeds need to exist in inventory
- Farmer needs to be assigned
- Harvest triggers auto-cook (which needs a kitchen structure?)
- Result is a food item dwarves can grab

Need to audit whether this whole chain actually works end-to-end. Probably doesn't.

### Medium: prepared meals vs raw food

- Raw food (mushrooms, meat, berries): satisfies hunger but no mood bonus, maybe small stress tick ("Ate raw food — not impressed")
- Prepared meal (cooked): satisfies hunger AND gives a happiness thought ("Ate a fine meal")
- Masterwork meal: big happiness boost, worth trading
- This creates a real incentive to invest in a kitchen + cook

---

## Pacing: why early game feels slow

The building taking forever is a different problem from food/water but related — it's all about **early game pacing**.

### Construction speed

Current construction is probably just `completion_pct += X per tick`. The issue might be:
- Dwarves keep getting interrupted (to eat, sleep, haul) before finishing
- Construction increment is just too small
- There aren't enough dwarves doing the work

Possible fixes:
- Increase base construction speed for the first few structures (early-game mercy)
- Show construction progress in the UI more clearly so players feel like things are moving
- Let multiple dwarves work on the same construction job (collaborative building)

### Starting structures

Could give the fortress a few free starting structures to reduce the "build everything from scratch" bottleneck:
- A rough campfire / outdoor kitchen
- A basic lean-to that counts as a bed
- Some crates of supplies

This is DF's embark wagon equivalent. You start with _something_.

### Job assignment at embark

Right now players probably need to manually assign jobs. If dwarves start with sensible defaults (1 miner, 1 farmer, 1 brewer, rest are generalists/haulers), the fort has a fighting chance before the player figures out the UI.

---

## Failure states should feel meaningful, not just frustrating

Right now dying feels cheap because:
- There's no warning before it's too late
- Death is instantaneous (need hits 0 → dead)
- No narrative around it

Better death arc:
1. Need drops below threshold → dwarf gets a thought ("Desperately thirsty" / "Starving")
2. Need hits critical → dwarf is incapacitated (can't work, moves slowly)
3. Need hits 0 → dwarf dies with a final thought logged
4. Graveyard system (already exists!) records the death with cause
5. Survivors get a negative thought for witnessing death

This makes death feel like a story beat rather than a silent game-over condition.

---

## Priority order (rough)

1. **Fix embark items (bug #488)** — dwarves need real food/drink at start
2. **Pond drinking** — `findNearestWaterSource` fallback to pond tiles
3. **Early game pacing** — increase construction speed or add starting structures
4. **Foraging** — low-effort food source while farm comes online
5. **Meaningful death states** — incapacitation before death, cause-of-death logging
6. **Water containers** — bottle-filling loop for mid-game
7. **Full farming audit** — make sure farm → harvest → cook chain actually works

---

## Open questions

- Should water quality matter? (pond = bad, well = neutral, brewed ale = good) Or is that too much complexity for now?
- How fast should needs decay? Current rates might be tuned for a faster sim tick than the player experiences.
- Should foraging ever run out? (deplete tile after N harvests, regrows over time)
- Can dwarves die of thirst in 10 minutes of realtime? If so that's too fast — needs decay rate needs a pass.
