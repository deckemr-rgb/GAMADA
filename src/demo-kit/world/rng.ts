/**
 * world/rng.ts — deterministic randomness (mulberry32) + Indonesian name generators, as before.
 * Same seed + same stream name ⇒ same sequence, on every machine. The PRNG itself is prng.ts (no data); the name
 * lists and generators are names.ts. Code that only needs random numbers should import prng.ts.
 */
export { mulberry32, hashString, makeRng, streamRng, type Rng } from './prng'
export { groupWeights, personName, makeNamer, type PersonName } from './names'
