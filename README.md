# Sidahmed Car — site + admin

## Files
| File | Role |
|---|---|
| `index.html` `style.css` `app.js` | Public site (search, filters, brand sections, car detail overlay) |
| `admin.html` `admin.css` `admin.js` | Admin panel (cars, sections, settings) |
| `common.css` | Shared styles + the CSS neon logo |
| `data.js` | Data layer (Firebase or demo mode) |
| `firebase-config.js` | **Paste your Firebase config here** |

Admin URL: `/admin.html` (not linked from the public site, `noindex`).

## Demo mode
While `firebase-config.js` still contains `YOUR_...` values, everything runs on sample data stored in the browser (localStorage). Open `admin.html` directly: no login, you can test the whole flow. Nothing is shared with other visitors until Firebase is configured.

## Go live (Firebase + Cloudflare Pages)
1. Firebase console → create a project.
2. **Build → Authentication → Sign-in method → Email/Password → enable.** Then *Users → Add user* (the client's email + password).
3. **Build → Firestore Database → Create database.** Then *Rules* tab, paste and publish:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read: if true;
         allow write: if request.auth != null;
       }
     }
   }
   ```
   (everyone can read the catalogue, only the logged-in admin can write)
4. *Project settings → Your apps → Web app (</>)* → copy the config object into `firebase-config.js`.
5. Push the folder to GitHub → Cloudflare Pages (no build command, output = root).
6. Firebase → Authentication → Settings → **Authorized domains** → add your `*.pages.dev` / custom domain.

## Adding photos and videos
Upload the files to Cloudinary, copy the delivery link (`https://res.cloudinary.com/...`) and paste it in the car form. Photo n°1 is the cover. For videos use `.mp4` (iPhone `.MOV` files are heavy and don't play everywhere).

## Data model (Firestore)
- `sections/{id}` → `name`, `order`
- `cars/{id}` → `sectionId`, `name`, `year`, `price`, `mileage`, `fuel`, `transmission`, `color`, `specs[{label,value}]`, `photos[]`, `video`, `createdAt`
- `settings/site` → `phone`, `whatsapp`, `address`, `heroImage`

To add a new suggested spec field in the form, edit `SUGGESTED_SPECS` at the top of `admin.js`.
