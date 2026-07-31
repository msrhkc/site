# MSR Bid Portal — Admin Guide

This is a plain-language guide for whoever manages listings, images, and contact/payment details
on the bid portal (`bid.html`). No coding knowledge is needed for day-to-day updates — you're mainly
adding image files and text files to folders, and editing a few lines near the top of the file for
contact/payment info.

---

## 1. Folder structure

All listing photos live inside an `images` folder, sitting next to `bid.html`:

```
images/
├── zone1/
├── zone2/
├── zone3/
└── miscellaneous/
```

These four folder names are fixed — the site is already built to look for exactly these four
folders. **Do not rename them, and don't add a fifth folder** (it won't show up unless a developer
adds it to the code first). They map to categories like this:

| Folder          | Category shown on site        |
|------------------|-------------------------------|
| `zone1`          | High Value Precision Salvage  |
| `zone2`          | Mid Tier Alloy Equipment      |
| `zone3`          | Bulk Structural Scrap         |
| `miscellaneous`  | Miscellaneous                 |

---

## 2. Adding a new listing (image)

Each listing is just one photo, dropped into the right zone folder.

**File naming:** Photos must be named with the listing's slot number, as a `.jpg` file. For
example, the first listing in `zone2` is:

```
images/zone2/1.jpg
```

The second is `2.jpg`, the third `3.jpg`, and so on. You don't need to zero-pad the filename
(`1.jpg` works fine) — but if you already have images padded like `00001.jpg`, that also works.
Don't mix two different photos under the same slot number in the same folder.

**Rules:**
- File type: **JPG only** (`.jpg`).
- Numbers don't need to be sequential with no gaps — you can have `1.jpg`, `2.jpg`, then skip to
  `5.jpg` and it will still show up (5 just won't have anything visually before it).
- The number in the filename **is the listing's slot number** — this is important because
  `details.txt` (see below) refers to listings by this same number.
- Deleting a photo removes that listing from the site. Removing a photo does **not** need any
  other cleanup — just delete the `.jpg` file.
- To replace a photo, upload a new file with the same slot number (it will overwrite it, or you
  may need to delete the old one first depending on how you're uploading).

**Listing numbers customers see:** The site automatically builds a listing number for each photo,
like `Z2-00002` — you don't need to type this anywhere yourself.

---

## 3. Adding details (title, price, description) — `details.txt`

By default, a listing only shows its photo and its auto-generated listing number. To add a title,
a suggested price, or a description, create a plain text file named exactly:

```
details.txt
```

...and place it **directly inside the zone folder**, next to the photos:

```
images/zone2/details.txt
```

Each zone folder has its own `details.txt`. There's one file per zone, and inside it you list
details for as many slot numbers in that zone as you want.

### Format

```
<1>
Title = Marine Diesel Generator, 250kW
Suggested Price = 850000
Description = Used marine diesel generator, decommissioned 2023.
Good working condition, minor surface rust on casing.

<2>
Title = Copper Cable Bundle, 500kg
Suggested Price = 120000
Description = Mixed-gauge copper cable, stripped and sorted.
```

**Rules:**
- `<1>`, `<2>`, etc. must match the **slot number of the photo** (i.e. `<2>` refers to
  `2.jpg`), and must be on their own line, wrapped in angle brackets.
- Each field is `Key = Value` on its own line. The three keys the site understands specially are:
  - `Title` — shown as the listing's name.
  - `Suggested Price` — must be a plain number (no commas, no "BDT", no currency symbol). E.g.
    `Suggested Price = 850000`.
  - `Description` — shown in the listing's detail pop-up.
- **Multi-line descriptions are supported.** Just keep typing on the next line without a new
  `Key =` — it will be added to whichever field came right before it. See the `Description` field
  in the `<1>` example above, which runs onto a second line.
- You can add other custom fields too (e.g. `Weight = 500kg`, `Condition = Used`) — anything that
  isn't `Title`, `Suggested Price`, or `Description` will still show up in the listing's detail
  pop-up as extra information.
- You don't have to add an entry for every photo. Photos with no matching `<N>` block just show
  up with their photo and listing number only.
- Blank lines between entries are fine and recommended for readability.
- If a listing's details don't seem to be showing up, double check: the number in `<N>` matches
  the photo's filename number, and there are no typos in `Title =` / `Suggested Price =` /
  `Description =` (they're not case-sensitive, but the `=` sign is required).

---

## 4. Swapping contact & payment details

All contact numbers, bank details, and the WhatsApp number are set in **one place** near the top
of the JavaScript in `bid.html`, in a block called `CONFIG`. Look for this in the file
(you can use Ctrl+F / Cmd+F to find `const CONFIG = {`):

```javascript
const CONFIG = {
    zones: [ ... ],          // do not edit — this defines the 4 folders above
    maxSlots: 1000,          // do not edit unless a developer tells you to
    whatsappNumber: '+8801319001751',
    phoneBidding: '09611336887',
    bankAccount: '004811100001128',
    bankRouting: '205154698',
    ...
};
```

To update contact or payment info, just edit the text between the quote marks:

| Line                          | What it controls                                                       |
|--------------------------------|--------------------------------------------------------------------------|
| `whatsappNumber: '...'`        | The WhatsApp number bids are forwarded to. Must include the `+` and country code, e.g. `'+8801319001751'`. |
| `phoneBidding: '...'`          | The phone number shown for phone bidding / help, across the whole site. |
| `bankAccount: '...'`           | The bank account number shown for deposits.                             |
| `bankRouting: '...'`           | The bank routing number shown for deposits.                             |

**Important:** Keep the quote marks (`'...'`) and the comma at the end of each line exactly as
they are — only change the text *inside* the quotes. Don't delete or add any punctuation.

**Bank name / branch / account name / fee amount:** These are written directly as page text
(not in `CONFIG`), because they're not expected to change often. If any of these need updating:
- "Southeast Bank PLC" (bank name)
- "Madam Bibir Hat, CTG" (branch)
- "Mehreen Ship Recycling" (account name)
- "BDT 500" (bid submission fee, appears in a few places)

...search for these exact phrases in `bid.html` and replace all occurrences, or send them to a
developer to update — they appear in more than one spot, so it's easy to miss one if updating by
hand.

---

## 5. Swapping the QR code

The payment step currently shows a **placeholder** icon labelled "(Replace with QR image)" instead
of a real QR code image. To put a real QR code in:

1. Save your QR code as an image file (e.g. `qr-code.png`) and place it somewhere in the project,
   such as a new `images/payment/` folder.
2. This part requires a small code edit — search `bid.html` for `qr-placeholder` and
   `(Replace with QR image)`, and replace that placeholder block with a real `<img>` tag pointing
   to your QR file (e.g. `<img src="images/payment/qr-code.png" alt="Payment QR code" />`).

This one step needs a developer or someone comfortable editing HTML — it's not a drag-and-drop
folder change like the listing photos.

---

## 6. Quick checklist for adding a new listing

1. Pick the right zone folder (`zone1`, `zone2`, `zone3`, or `miscellaneous`).
2. Find the next unused slot number in that folder.
3. Save the photo as `{number}.jpg` in that folder (e.g. `14.jpg`).
4. (Optional) Open `details.txt` in the same folder, add a new `<14>` block with `Title =`,
   `Suggested Price =`, and `Description =` lines.
5. Save. No other steps needed — the site scans the folders automatically when someone visits.

## 7. Things to avoid

- Don't rename the `zone1` / `zone2` / `zone3` / `miscellaneous` folders.
- Don't use file types other than `.jpg` for listing photos.
- Don't reuse the same slot number for two different items in the same zone.
- Don't remove the quote marks, commas, or `CONFIG` structure when editing contact/bank details.
- Don't edit anything else inside the `<script>` section of `bid.html` unless you're a developer —
  it can break bid submissions for everyone.
