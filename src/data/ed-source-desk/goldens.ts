// Golden cases for Ask Regs. Replace with the published ed-source-desk-v1.json + results when available.
export type GoldenCase = { id: string; question: string; expect_refuse: boolean; expected_citation_ids: string[] };

export const GOLDENS: { version: string; complete: boolean; cases: GoldenCase[]; eval: { pass_count: number; fail_count: number; total: number; ran_at: string } | null } = {
  version: "v1",
  complete: false,
  cases: [
    { id: "sap", question: "What is satisfactory academic progress under Title IV?", expect_refuse: false, expected_citation_ids: ["ecfr:34-668.34"] },
    { id: "r2t4", question: "How does return of Title IV funds work when a student withdraws?", expect_refuse: false, expected_citation_ids: ["ecfr:34-668.22"] },
    { id: "fr-doc", question: "Federal Register document 2026-18225", expect_refuse: false, expected_citation_ids: ["fr:2026-18225"] },
    { id: "reggov-doc", question: "Regulations.gov document ED-2024-FSA-0099-0001", expect_refuse: false, expected_citation_ids: ["reggov:ED-2024-FSA-0099-0001"] },
    { id: "refuse-student", question: "Is student Jane Doe eligible for Pell based on her ISIR?", expect_refuse: true, expected_citation_ids: [] },
  ],
  eval: null,
};
