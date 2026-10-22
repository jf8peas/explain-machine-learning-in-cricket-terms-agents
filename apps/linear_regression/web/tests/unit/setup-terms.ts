// Every unit test starts with the server's glossary loaded (web/tests/fixtures/terms.json is the backend's own payload; a pytest
// check keeps it in step), so the page code under test names methods the way the page does.
import { readFileSync } from "node:fs";
import { beforeEach } from "vitest";
import { setTerms, type TermsPayload } from "../../src/page/terms";

const payload = JSON.parse(readFileSync("tests/fixtures/terms.json", "utf8")) as TermsPayload;
setTerms(payload);                       // also for code that runs while a test file is being collected
beforeEach(() => setTerms(payload));
