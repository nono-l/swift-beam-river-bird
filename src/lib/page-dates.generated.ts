/* このファイルは scripts/page-dates.mjs が書く。手で直さない。 */
export const PAGE_DATES: Record<string, { modified: string; published?: string }> = {
  "/": {
    "modified": "2026-11-06T01:23:05+09:00"
  },
  "/how": {
    "modified": "2026-10-06T18:22:26+09:00"
  },
  "/terms": {
    "modified": "2026-10-07T06:56:27+09:00"
  },
  "/login": {
    "modified": "2026-10-06T18:22:26+09:00"
  }
};

export const PAGE_DATE_LEDGER: Record<string, { modified: string; hash: string; published?: string }> = {
  "/": {
    "modified": "2026-11-06T01:23:05+09:00",
    "hash": "919e9ec54de95ed918763c9001f82d7e73d06832fa80459ef23bbe4a5eaf5b23"
  },
  "/how": {
    "modified": "2026-10-06T18:22:26+09:00",
    "hash": "06a38f9acc47523422a4850ce5d1c4efed4ae9d3377c8d051aed41a009777a3e"
  },
  "/terms": {
    "modified": "2026-10-07T06:56:27+09:00",
    "hash": "b8a02adef49140133f1b26544018fea546525707937078fc8b5712c2cd861ff0"
  },
  "/login": {
    "modified": "2026-10-06T18:22:26+09:00",
    "hash": "ab0d9acd2376a1a578d3f5fa121810582ce7b1de6c6c0944c5e8db1ddfbef655"
  }
};
