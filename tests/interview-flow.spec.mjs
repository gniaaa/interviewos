import { expect, test } from "@playwright/test";

test("candidate can complete a mock interview and view an evaluation", async ({
  page,
}) => {
  await page.goto("/interview");
  await expect(page.locator("html[data-interviewos-ready='true']")).toBeAttached();

  await expect(page.getByRole("heading", { name: "Practice workspace" })).toBeVisible();
  await page.getByRole("button", { name: "Begin interview" }).click();
  await expect(page.getByText("Let's practice: Design a URL shortener")).toBeVisible();

  const answerBox = page.getByPlaceholder("Type your answer as the candidate...");
  await expect(answerBox).toBeVisible();

  await answerBox.fill(
    "First I would clarify requirements and constraints, then define a create-short-url API and a redirect API. I would store the mapping in a database and use a cache for hot redirects. The first tradeoff is simple random codes versus coordinated uniqueness because coordination adds complexity.",
  );
  await answerBox.press("Enter");

  await expect(
    page.getByText(
      "What failure mode, abuse case, or operational concern would you handle next?",
    ),
  ).toBeVisible();
  await expect(page.getByText("Agent state")).toBeVisible();

  await page.getByRole("button", { name: "End & evaluate" }).click();
  await expect(page.getByRole("heading", { name: "Session evaluation" })).toBeVisible();
  await expect(page.getByText("Overall score")).toBeVisible();
  await expect(page.getByText("Rubric breakdown")).toBeVisible();
  await expect(page.getByText("Suggested next drill")).toBeVisible();
});

test("candidate can discard an active interview without scoring it", async ({
  page,
}) => {
  await page.goto("/interview");
  await expect(page.locator("html[data-interviewos-ready='true']")).toBeAttached();

  await page.getByRole("button", { name: "Begin interview" }).click();
  await expect(page.getByText("Let's practice: Design a URL shortener")).toBeVisible();

  await page.getByRole("button", { name: "Discard" }).click();
  await expect(page.getByRole("heading", { name: "Practice workspace" })).toBeVisible();
  await expect(page.getByText("Session discarded.").first()).toBeVisible();
  await expect(page.getByPlaceholder("Begin an interview first")).toBeDisabled();
});
