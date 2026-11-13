# data/ — owner: Hagras

Real inputs, all traceable to NASA.

| Path | What | Status |
|---|---|---|
| `horizons/client.ts` | `fetchHorizons()`: browser client for `/api/horizons` with offline fixture fallback | ✅ |
| `horizons/types.ts` | Proxy response shape | ✅ |
| `horizons/fixtures/` | Recorded Horizons answers for offline demos (`fixtureKey(query).json`) | Sat |
| `sites/` | Sourced site catalogue (Apollo, Luna, Chang'e, Chandrayaan-3, SLIM, IM-1/2, Blue Ghost, Artemis III regions) | overnight |
| `horizons-lola/` | LOLA → horizon profiles per demo site (`HorizonProfile`) | overnight |
