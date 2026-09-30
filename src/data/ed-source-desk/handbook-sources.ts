// Handbook chapters the admin importer may fetch. Each entry carries the checks the parsed page
// must pass before anything is embedded or written (see src/lib/handbook-parse.ts checkChapter).
// Expected values come from the reviewed manifest docs/ed-source-desk/vol7-ch2-2026-27-review-manifest.json.
import type { ExpectedChecks, MinimalChecks } from "@/lib/handbook-parse";

export type HandbookSource = {
  id: string;
  /** The chapter page. When `discover` is set, the page is instead found from a link on another chapter's page. */
  url: string | null;
  /**
   * Find the chapter from a link on another page. `from` is tried in order; an entry is a URL or
   * "source:<id>" (that source's resolved page, so chapters can be found one after another).
   */
  discover?: { from: string | string[]; path_pattern: RegExp };
  /** Import only when the caller confirms the content hash a dry-run reported (chapters without a reviewed manifest). */
  require_confirmed_hash?: boolean;
  award_year: string;
  volume: number;
  chapter: number;
  title: string;
  /** Human label prefix for citation_ref; the chunk heading is appended. */
  label: string;
  expected: ExpectedChecks | MinimalChecks;
};

export const HANDBOOK_SOURCES: HandbookSource[] = [
  {
    id: "fsa-hb-2026-27-vol7-ch2",
    url: "https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/vol7/ch2-calculating-pell-grants",
    award_year: "2026-27",
    volume: 7,
    chapter: 2,
    title: "2026-27 FSA Handbook, Volume 7, Chapter 2: Calculating Pell Grants",
    label: "FSA Handbook 2026-27, Vol 7, Ch 2",
    expected: {
      sections: 10,
      tables: 4,
      table_rows_by_section: {
        "Maximum Pell Grant Eligibility Criteria": 8,
        "Minimum Pell Grant Eligibility Criteria": 7,
      },
      examples: 3,
      fictional_note: true,
      step_labels: ["Step 1", "Step 2", "Step 3", "Step 4"],
    },
  },
  {
    // Stage 2B. The Chapter 3 address and structure are not known in advance (no reviewed manifest):
    // the page is found from Chapter 2's link, only sanity checks apply, the import requires the dry-run's
    // content hash, and the owner reviews the staged chapter on the preview before promote.
    id: "fsa-hb-2026-27-vol7-ch3",
    url: null,
    discover: {
      from: "https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/vol7/ch2-calculating-pell-grants",
      path_pattern: /\/fsa-handbook\/2026-2027\/vol7\/ch3-[a-z0-9-]+\/?$/,
    },
    require_confirmed_hash: true,
    award_year: "2026-27",
    volume: 7,
    chapter: 3,
    title: "2026-27 FSA Handbook, Volume 7, Chapter 3",
    label: "FSA Handbook 2026-27, Vol 7, Ch 3",
    expected: { min_sections: 3, min_chunks: 3 },
  },
  {
    id: "fsa-hb-2026-27-vol7-ch1",
    // Batch after Stage 2B: the rest of Volume 7, same rules as Chapter 3 (found by link, structural checks,
    // confirmed hash, owner review before promote). A chapter that does not exist reports "link not found".
    url: null,
    discover: { from: ["https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/vol7/ch2-calculating-pell-grants"], path_pattern: /\/fsa-handbook\/2026-2027\/vol7\/ch1-[a-z0-9-]+\/?$/ },
    require_confirmed_hash: true,
    award_year: "2026-27",
    volume: 7,
    chapter: 1,
    title: "2026-27 FSA Handbook, Volume 7, Chapter 1",
    label: "FSA Handbook 2026-27, Vol 7, Ch 1",
    expected: { min_sections: 3, min_chunks: 3 },
  },
  {
    id: "fsa-hb-2026-27-vol7-ch4",
    url: null,
    discover: { from: ["https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/vol7/ch2-calculating-pell-grants", "source:fsa-hb-2026-27-vol7-ch3"], path_pattern: /\/fsa-handbook\/2026-2027\/vol7\/ch4-[a-z0-9-]+\/?$/ },
    require_confirmed_hash: true,
    award_year: "2026-27",
    volume: 7,
    chapter: 4,
    title: "2026-27 FSA Handbook, Volume 7, Chapter 4",
    label: "FSA Handbook 2026-27, Vol 7, Ch 4",
    expected: { min_sections: 3, min_chunks: 3 },
  },
  {
    id: "fsa-hb-2026-27-vol7-ch5",
    url: null,
    discover: { from: ["https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/vol7/ch2-calculating-pell-grants", "source:fsa-hb-2026-27-vol7-ch4"], path_pattern: /\/fsa-handbook\/2026-2027\/vol7\/ch5-[a-z0-9-]+\/?$/ },
    require_confirmed_hash: true,
    award_year: "2026-27",
    volume: 7,
    chapter: 5,
    title: "2026-27 FSA Handbook, Volume 7, Chapter 5",
    label: "FSA Handbook 2026-27, Vol 7, Ch 5",
    expected: { min_sections: 3, min_chunks: 3 },
  },
  {
    id: "fsa-hb-2026-27-vol7-ch6",
    url: null,
    discover: { from: ["https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/vol7/ch2-calculating-pell-grants", "source:fsa-hb-2026-27-vol7-ch5"], path_pattern: /\/fsa-handbook\/2026-2027\/vol7\/ch6-[a-z0-9-]+\/?$/ },
    require_confirmed_hash: true,
    award_year: "2026-27",
    volume: 7,
    chapter: 6,
    title: "2026-27 FSA Handbook, Volume 7, Chapter 6",
    label: "FSA Handbook 2026-27, Vol 7, Ch 6",
    expected: { min_sections: 3, min_chunks: 3 },
  },
];

export const findHandbookSource = (id: string) => HANDBOOK_SOURCES.find((s) => s.id === id) ?? null;
