# DemoAssets

Source images for `npm run db:seed-demo`. The seed script copies files from here into `backend/uploads/` (gitignored) and references them in database rows.

## Folder structure

```
DemoAssets/
├── Nails/              # Nail art images (~20 files)
│   ├── *.jpg
│   ├── *.png
│   └── ...
└── ProfilePhotos/
    ├── Emma.jpg
    ├── Customer1.png
    ├── Customer2.png
    ├── Customer3.png
    └── Customer4.png
```

## Nails folder

- Put all demo nail images in `DemoAssets/Nails/`
- Supported extensions: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`
- **The seed uses every image file in this folder** — no fixed count in code
- Current set: ~20 images (reduced from a larger original collection)
- Adding or removing files changes how many portfolio photos and attachment variants are seeded

Used for:

- Emma's public portfolio gallery
- Appointment inspo and completed-visit photos
- Support ticket attachments

## ProfilePhotos folder

Required files (referenced by name in `backend/scripts/seed-demo.js`):

| File | Used for |
|------|----------|
| `Emma.jpg` | Admin profile + home hero |
| `Customer1.png` | demo1@fake.com (Maya) |
| `Customer2.png` | demo2@fake.com (Zuri) |
| `Customer3.png` | demo3@fake.com (Victoria) |
| `Customer4.png` | demo4@fake.com (Elena) |

## Running the seed

```bash
cd backend
npm run db:setup      # first time only
npm run db:seed-demo  # truncates all emmasenvy data, then re-seeds
```

**Warning:** `db:seed-demo` deletes all rows in every `emmasenvy` table before inserting demo data. Safe to re-run when you want a clean demo state.

## Troubleshooting

| Error | Fix |
|-------|-----|
| `DemoAssets/Nails folder not found` | Create `DemoAssets/Nails/` and add image files |
| `DemoAssets/Nails has no image files` | Add at least one supported image |
| Missing profile photo error | Ensure all five `ProfilePhotos/` files exist |

## Do not edit `backend/uploads/` for demo refresh

Upload paths are regenerated on each seed. To update demo images, change files in `DemoAssets/` and run `db:seed-demo` again.
