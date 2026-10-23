# Manual acceptance tests

Run the backend and frontend, create a user, and add reference documents before these tests.

| Test | Input | Expected result |
|---|---|---|
| Exact copy | Scan the same text as a reference | Exact match passages; score greater than 0 |
| Original text | Text unrelated to references | No matches / 0% |
| Modified sentence | Change a few words in a copied sentence | Near-duplicate match if fuzzy ratio is at least 82 |
| Semantic paraphrase | Rewrite a source sentence with different words | Semantic match only if the optional Sentence Transformers model is installed/enabled and similarity meets threshold |
| TXT upload | Valid UTF-8 TXT | Extract and scan |
| DOCX upload | DOCX with paragraphs | Extract and scan |
| PDF upload | Text-based PDF | Extract and scan |
| Unsupported file | PNG or XLSX | Clear 400 error |
| Empty file | Empty TXT or image-only/scanned PDF | Clear readable-content error |
| File too large | File larger than configured limit | Clear 413 error |
| History | Complete a scan then open history | Scan is listed and report reopens |
| PDF report | Click Export PDF | Downloadable report opens |
| User isolation | Sign in as another account | First account's scans are not visible |
| Delete scan | Delete a saved scan | It disappears from history |
| Reference source | Scan text matching a reference | Reference document name and excerpt shown |
