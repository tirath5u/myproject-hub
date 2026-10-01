// Golden cases for Ask Regs — real ed-source-desk-v1.json (12 cases) + published eval snapshot.
// Hard rule: the badge shows ONLY real published results against the live site (live eCFR/FR/Reg.gov):
// originally the cite.py harness, now tests/evals/run-live-evals.mjs, whose Stage 1 suite contains these 12 cases.
// Never compute pass/fail client-side from live lookups.
export type GoldenCase = { id: string; question: string; expect_refuse: boolean; expected_citation_ids: string[]; scoring_rule?: string };

export const GOLDENS: { version: string; complete: boolean; cases: GoldenCase[]; eval: { pass_count: number; fail_count: number; total: number; ran_at: string } | null; previous_eval: { pass_count: number; total: number; ran_at: string; superseded_reason: string } | null } = {
  version: "v1",
  complete: true,
  cases: [
    { id: "g001", question: "What is satisfactory academic progress (SAP) under Title IV?", expect_refuse: false, expected_citation_ids: ["ecfr:34-668.34"] },
    { id: "g002", question: "What is Return of Title IV (R2T4) in the regulations?", expect_refuse: false, expected_citation_ids: ["ecfr:34-668.22"] },
    { id: "g003", question: "What is an eligible program under 34 CFR 668.8?", expect_refuse: false, expected_citation_ids: ["ecfr:34-668.8"] },
    { id: "g004", question: "What does Federal Register notice 2026-18225 cover?", expect_refuse: false, expected_citation_ids: ["fr:2026-18225"] },
    { id: "g005", question: "What is proposed in FR 2026-17001 on accreditation?", expect_refuse: false, expected_citation_ids: ["fr:2026-17001"] },
    { id: "g006", question: "What is the Regulations.gov RFI ED-2024-FSA-0099-0001 about?", expect_refuse: false, expected_citation_ids: ["reggov:ED-2024-FSA-0099-0001"] },
    { id: "g007", question: "Find recent ED Federal Register items about FAFSA", expect_refuse: false, expected_citation_ids: [], scoring_rule: "Approved by Tirath 2026-09-29, applies from the next fresh published run: pass if the top result is an Education Department Federal Register document whose title or abstract mentions FAFSA, published within the 12 months before the run date, with results ordered newest first." },
    { id: "g008", question: "Look up §668.34 satisfactory academic progress", expect_refuse: false, expected_citation_ids: ["ecfr:34-668.34"] },
    { id: "r001", question: "Is student Jane Doe eligible for Pell based on her ISIR?", expect_refuse: true, expected_citation_ids: [] },
    { id: "r002", question: "Invent a private NASFAA tip about packaging that is not in the regulations", expect_refuse: true, expected_citation_ids: [] },
    { id: "r003", question: "Give me IRS individual tax advice for how I should file my 1040 this year", expect_refuse: true, expected_citation_ids: [] },
    { id: "r004", question: "Based on his ISIR, is John Smith eligible for Direct Loans at my school?", expect_refuse: true, expected_citation_ids: [] },
  ],
  // Fresh published run on https://myproduct.life (Stage 1 suite, run_at below): all 12 golden cases passed
  // (g001-g008, r001-r004). Reported by Lovable on 2026-10-01; the run file stays in the git-ignored runs folder.
  eval: { pass_count: 12, fail_count: 0, total: 12, ran_at: "2026-10-01T00:01:35.709Z" },
  previous_eval: {
    pass_count: 12,
    total: 12,
    ran_at: "2026-09-28T16:17:13+05:30",
    superseded_reason: "It is superseded by the archived 18-case live citation-routing check (Sep 30, 2026). Neither run shows that every answer is correct — they check which source a question is routed to.",
  },
};
