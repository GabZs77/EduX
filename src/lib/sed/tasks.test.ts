import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOpenTask, isSubmittedAnswer, studentAnswerStatus } from "./tasks.ts";

describe("studentAnswerStatus", () => {
  it("treats a missing answer as pending even when the assignment status is finished", () => {
    assert.equal(studentAnswerStatus({ answer_status: null, status: "finished" }), "pending");
    assert.equal(studentAnswerStatus({ status: "finished" }), "pending");
    assert.equal(studentAnswerStatus({ answer_status: "", status: "complete" }), "pending");
  });

  it("prefers answer_status over the assignment status", () => {
    assert.equal(studentAnswerStatus({ answer_status: "draft", status: "finished" }), "draft");
    assert.equal(studentAnswerStatus({ answer_status: "submitted", status: "finished" }), "submitted");
  });
});

describe("open vs submitted", () => {
  it("keeps pending, draft and expired tasks visible", () => {
    assert.equal(isOpenTask("pending"), true);
    assert.equal(isOpenTask("draft"), true);
    assert.equal(isOpenTask("expired"), true);
    assert.equal(isOpenTask(""), true);
    assert.equal(isSubmittedAnswer("pending"), false);
    assert.equal(isSubmittedAnswer("draft"), false);
  });

  it("hides only actually submitted answers", () => {
    assert.equal(isSubmittedAnswer("submitted"), true);
    assert.equal(isSubmittedAnswer("finished"), true);
    assert.equal(isOpenTask("submitted"), false);
    assert.equal(isOpenTask("finished"), false);
  });
});
