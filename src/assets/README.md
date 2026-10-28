# Image assets

Put your PNG files here, then wire them up in **`images.ts`**.

```
src/assets/
├── images.ts            ← the only file you edit
├── tsa-house-logo.png   ← your brand logo
└── houses/
    ├── tsa.png
    ├── yang.png
    ├── khant.png
    ├── irve.png
    ├── tsen.png
    ├── buhu.png
    ├── maza.png
    └── hawt.png
```

## Adding the TSA HOUSE logo

1. Save your file as `src/assets/tsa-house-logo.png`
2. In `images.ts`, uncomment the import:
   ```ts
   import brandLogoPng from './tsa-house-logo.png'
   ```
3. Set the value:
   ```ts
   export const BRAND_LOGO: string | null = brandLogoPng
   ```

The logo appears in the menu header and the page footer.

## Adding a house crest

1. Save the file, e.g. `src/assets/houses/maza.png`
2. Uncomment its import in `images.ts`:
   ```ts
   import mazaPng from './houses/maza.png'
   ```
3. Swap the `null` for it:
   ```ts
   MAZA: mazaPng,
   ```

Crests show up in the house picker, the leaderboard rows, and the death screen.
You can do one house at a time — any house left as `null` keeps the colored
initial fallback.

## Notes

- **Formats:** PNG, JPG, SVG, WEBP. Transparent PNG recommended.
- **Size:** square images, 128×128 or larger.
- Images are bundled and inlined automatically — no server paths needed.
- Display tweaks (`contain`/`cover`, padding, background) are at the bottom of `images.ts`.
