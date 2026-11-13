# data/ — owner: Hagras

Real inputs, all traceable to NASA.

| Path | What | Status |
|---|---|---|
| `horizons/client.ts` | `fetchHorizons()`: browser client for `/api/horizons` with offline fixture fallback | ✅ |
| `horizons/types.ts` | Proxy response shape | ✅ |
| `horizons/fixtures/` | Recorded Horizons answers for offline demos (`fixtureKey(query).json`) | Sat |
| `sites/` | Sourced site catalogue: 43 sites (Apollo, Surveyor, Luna, Chang'e, Chandrayaan, SLIM, Beresheet, Luna 25, ispace, IM-1/2, Blue Ghost 1, Connecting Ridge / Moon Base I). Coordinates from NASA NSSDC (LROC-measured where noted) and NASA documents; see `sites/sources.ts`. Artemis regions: NASA's nine 2024 regions, each placed at a real landing site from Wueller et al. 2026 (open data, Zenodo 10.5281/zenodo.17084058): the published site closest to the middle of that region's sites. **Pending:** Shackleton rim, upcoming targets without a published point. | ✅ v1 |
| `horizons-lola/` | LOLA → horizon profiles per demo site (`HorizonProfile`) | overnight |
