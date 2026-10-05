# Run the pattern-pack tests on your PC (Windows)

These steps assume Windows (PowerShell), Node.js 18+, and a local MongoDB you control. The tests live in this `tests` folder (also under Google Drive `GrokBot-Share/mongo-pattern-pack/node-volume/tests/`).

## What you need

1. **Node.js 18+** — https://nodejs.org (LTS is fine). Check with `node -v`.
2. **MongoDB Community Server** (or another mongod on localhost) listening on port **27017** by default.
3. **Atlas sample data** restored into that mongod (`sample_supplies` and `sample_mflix` at minimum).
4. This **`tests`** folder on disk (download from Drive if needed).

You do **not** need the Linux `local-mongo/` tree from the authoring machine. That is only how the book maintainer’s box runs Mongo.

---

## 1. Install and start MongoDB

Install [MongoDB Community](https://www.mongodb.com/try/download/community) for Windows and start the service (Installer option “Install MongoD as a Service” is fine).

Confirm it accepts connections:

```powershell
mongosh --eval "db.runCommand({ ping: 1 })"
```

If `mongosh` is not on your PATH, use the full path from the MongoDB install directory, or Compass’s shell.

---

## 2. Load the official sample archive (once)

In PowerShell (any working directory with write access):

```powershell
curl.exe -L https://atlas-education.s3.amazonaws.com/sampledata.archive -o sampledata.archive
mongorestore --archive=sampledata.archive --port=27017
```

`mongorestore` ships with [MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools) if it is not already installed.

Quick check:

```powershell
mongosh --quiet --eval @"
print('sales: ' + db.getSiblingDB('sample_supplies').sales.countDocuments());
print('movies: ' + db.getSiblingDB('sample_mflix').movies.countDocuments());
print('comments: ' + db.getSiblingDB('sample_mflix').comments.countDocuments());
"@
```

Expect on the order of **5000** sales, **~21k** movies, **~41k** comments.

### Optional: index for Pattern 6

Speeds up the `$lookup` test (avoids scanning all comments):

```powershell
mongosh --quiet --eval "db.getSiblingDB('sample_mflix').comments.createIndex({ movie_id: 1 })"
```

---

## 4. Install dependencies and run

```powershell
cd path\to\tests
npm install
npm test
```

### If `npm test` fails with `Cannot find module ...\\patterns`

That comes from an older `package.json` that ran `node --test patterns/`. On Windows, Node can treat that folder path as a module. Grab the updated `package.json` plus `run-tests.cjs` from Drive (or copy them from this folder). Then:

```powershell
npm test
```

One-shot workaround without those files:

```powershell
node --test --test-concurrency=1 (Get-ChildItem .\patterns\*.test.js | ForEach-Object FullName)
```


## Troubleshooting

| Symptom | What to try |
|--------|-------------|
| `ECONNREFUSED` / server selection error | Is mongod running? Correct `MONGODB_URI`? Firewall blocking localhost? |
| Empty / zero counts in assertions | Sample archive not restored, or connected to a different port/instance |
| Pattern 6 very slow | Create the `comments.movie_id` index above |
| `npm` / `node` not found | Install Node LTS and open a **new** PowerShell window |
| Duplicate files in Drive | Keep the newest `README.md` and `package.json` by modified time |

---

## Notes

- Assertions check **shapes and invariants**, not brittle exact revenue totals.
- Stopping mongod is your responsibility; the test suite does not start or stop the database.
- For day-to-day authoring, the maintainer uses a Linux local Mongo under `local-mongo/`; your Windows setup only needs Community Server + `sampledata.archive` + this folder.
