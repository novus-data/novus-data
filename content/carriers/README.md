# Carrier fleet lists

One JSON file per carrier, each written by `npm run carriers:import` from a file
a person saved from **the carrier's own published fleet page**, after reading
that page's terms. See DEPLOY.md, "Loading a carrier's fleet list", and
CLAUDE.md §6a, "The ships panel".

Nothing here may be typed from memory, copied from a commercial vessel
database, a tracking site or Wikipedia, or written by an AI assistant. A record
that fails validation (src/lib/carriers/sources/local-files.ts) does not load.
