## Debugging Console Logs

When debugging issues, the AI must:

1. *Be specific about what logs are needed* - Never say "check the console" or "expand the Object"
2. *Add targeted console.log statements* with clear labels showing exactly what values to look for
3. *Tell the user the exact log line to find* (e.g., "[ComponentName] State: ...")
4. *List the specific properties needed* from any objects (e.g., "I need: isLoading, hasCurrentImage, isInputDisabled")
5. *Add temporary debug logging* that outputs the exact data structure needed to diagnose the issue

Example of good debugging:
console.log('[DEBUG] Input state:', {
  isDisabled: isInputDisabled,
  isLoading: isLoading,
  hasImage: hasCurrentImage,
});Then tell user: "Look for the line that says '[DEBUG] Input state:' and tell me the values of isDisabled, isLoading, and hasImage"

*Never ask user to:*
- "Check the console for errors"
- "Expand the Object"
- "Look at the console output"

*Always:*
- Add specific logging code
- Tell them the exact log label to find
- List the exact properties you need to see

## Legacy Code Cleanup

When implementing new features or making changes, the AI must:

1. *Always delete legacy code* - Don't leave old code paths "just in case"
2. *Remove backward compatibility* - If migrating to a new pattern, remove the old pattern completely
3. *Delete unused imports* - Remove any type imports or dependencies that are no longer used
4. *Clean up comments* - Remove "backward compat", "legacy", or "deprecated" comments referring to deleted code
5. *No fallback logic* - Avoid `oldPattern ?? newPattern` - choose one and commit

*Rationale:*
Legacy code creates bugs, confusion, and maintenance burden. Clean breaks are better than dual-system support.

## Console Log Cost Convention

*Rule:* Does it call Firebase/Google servers? → `(IS $)` | Does it run locally in the browser? → `(NO $)`

Use these prefixes in debug logs to instantly identify billed Firestore operations versus free local operations (React state, IndexedDB).

In software development, we often follow the pattern:
Make it work (Fix the bug/logic)
Make it right (Clean up the code/architecture)
Make it fast (Optimize/Cache)

Follow this pattern, always tell me what step we are on.