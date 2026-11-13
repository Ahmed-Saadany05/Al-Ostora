# data/ — owner: Hagras

Real inputs, all traceable to NASA.

| Path | What | Status |
|---|---|---|
| `horizons/client.ts` | `fetchHorizons()`: browser client for `/api/horizons` with offline fixture fallback | ✅ |
| `horizons/types.ts` | Proxy response shape | ✅ |
| `horizons/fixtures/` | Recorded Horizons answers for offline demos (`fixtureKey(query).json`) | Sat |
| `sites/` | Sourced site catalogue: 34 sites (Apollo, Surveyor, Luna, Chang'e, Chandrayaan, SLIM, Beresheet, Luna 25, ispace, IM-1/2, Blue Ghost 1, Connecting Ridge / Moon Base I). Coordinates from NASA NSSDC (LROC-measured where noted) and NASA documents; see `sites/sources.ts`. **Pending:** 9 Artemis regions, Shackleton rim, upcoming targets without a published point. | ✅ v1 |
| `horizons-lola/` | LOLA → horizon profiles per demo site (`HorizonProfile`) | overnight |
