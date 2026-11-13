# LOLA horizon profiles: owner Hagras

Computes the real terrain skyline around every catalogue site south of 60° S from NASA LOLA elevation maps. It writes one `HorizonProfile` JSON per site into `src/data/horizons-lola/`. The app uses these automatically (they show as "Real terrain (NASA LOLA)"), and sites without a file fall back to the labelled demo horizon.

```bash
npm run horizons:download        # once: 80 m + 240 m maps (~390 MB) into ~/.refaey-dem-cache
npm run horizons                 # all catalogue sites south of 60° S
npm run horizons -- haworth      # one site
npm run horizons -- --validation # Gläser 2018 points S and C1 at 0 m and 2 m → scripts/horizons/validation/
```

## Method
- **720 azimuths (0.5°)**, geographic: clockwise from lunar north.
- Along each great-circle ray, e = atan2(r_t·cos γ − r_o, r_t·sin γ), keeping the maximum. Here r_o = R + h_site + 2 m and r_t = R + h(point), with R = 1737.4 km. Lunar curvature is therefore exact.
- **Nested DEMs** (Barker 2021):
  - 0–3 km: the finest map that loads within 3 minutes (5 m → 10 m → 20 m → 30 m → 60 m)
  - 3–100 km: 80 m (60 m where the 80 m map doesn't reach)
  - 100–310 km: 240 m
- If a map fails to load, the script falls back to the next coarser one. **Each file records the maps it actually used** (`dem.layers`), its reach, the site height and the fraction of samples without data.
- Frame: MOON_ME (DE421). Heights are float32 metres above the sphere; NaN = no data (skipped).

## Data
NASA PGDA, Barker et al. 2021 / 2023, read as cloud-optimized GeoTIFFs (only the needed tiles):
- [Product 81: 5 m mosaic, 87–90° S](https://pgda.gsfc.nasa.gov/products/81)
- [Product 90: 10–240 m maps, 60–90° S](https://pgda.gsfc.nasa.gov/products/90)

## Cross-checks
- **Projection:** heights at known places come out right: Shackleton floor −2.8 km, rim +0.8 km, Malapert +4.8 km, Haworth floor −3.3 km. Six products agree on Connecting Ridge's height to within 3 m.
- **LROC QuickMap** (quickmap.lroc.im-ldi.com) shows the same LOLA terrain. Use its elevation-profile tool to spot-check a ridge in a given direction. It has no data API, so it isn't used as an input.
- **Validation (planned):** NASA PGDA illumination maps (product 69) at a 0 m horizon, plus Gläser 2018 S and C1 at 0 m and 2 m.
