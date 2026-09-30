// Handbook chapters the admin importer may fetch. Each entry carries the checks the parsed page
// must pass before anything is embedded or written (see src/lib/handbook-parse.ts checkChapter).
// Expected values come from the reviewed manifest docs/ed-source-desk/vol7-ch2-2026-27-review-manifest.json.
import type { ExpectedChecks } from "@/lib/handbook-parse";

export type HandbookSource = {
  id: string;
  url: string;
  award_year: string;
  volume: number;
  chapter: number;
  title: string;
  /** Human label prefix for citation_ref; the chunk heading is appended. */
  label: string;
  expected: ExpectedChecks;
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
];

export const findHandbookSource = (id: string) => HANDBOOK_SOURCES.find((s) => s.id === id) ?? null;
