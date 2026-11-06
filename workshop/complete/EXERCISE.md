# Exercise: delegate one bounded task

Open `src/delegate.ts`. The `buildDelegateTool()` function is the only file you need to change for the exercise.

Your specialist launcher receives a task object from the parent. Implement the `run` function so it:

1. Rejects invalid input when there is no task string.
2. Uses the requested tool names when they are present.
3. Rejects a request that selects no valid tools.
4. Calls `runAgent()` with the delegated task, optional context, selected tools, injected inference function, and step budget.
5. Returns only `{ status, stepsUsed, conclusion }` from the specialist report.

The specialist must receive a fresh conversation history. Pass `options.allTools` filtered to the requested names. Do not add the `delegate` tool to that list; this is what prevents recursive delegation.

Run the focused test while you work:

```bash
npm run build
node --test dist/tests/delegate.test.js
```

The complete workshop does not require a model or Cloudflare account. The scripted inference in the tests is the model substitute.
