Implement a stronger desktop horizontal-scroll fix so trackpad swipes stay inside the app instead of triggering browser navigation.

1. Add a real horizontal scroll surface for the calendar
- Wrap the desktop calendar grid in an explicit `overflow-x-auto` container.
- Give Week and Month desktop layouts a minimum width so the grid can actually scroll sideways instead of shrinking to fit.
- Keep Day view unchanged except where needed for consistent container behavior.

2. Stop the calendar from collapsing to fit the viewport
- Update the Week view columns so they do not compress with `min-w-0` on desktop.
- Use fixed/min widths per day column and keep the time axis pinned, so horizontal gestures have scrollable content to act on.
- Apply the same approach to Month view if needed so desktop swipes always have a target scroll container.

3. Add desktop gesture handling for Mac trackpads
- Add a small reusable horizontal-scroll handler that listens for wheel/trackpad gestures on the calendar scroller.
- When the calendar can scroll left/right, prevent the browser gesture and move the container horizontally instead.
- Only intercept horizontal intent, so normal vertical scrolling still works.

4. Apply the fix where it matters most
- Attach the handler to the admin calendar desktop container first.
- If needed, reuse the same pattern on other explicit horizontal scroll regions in the app rather than forcing global behavior everywhere.

5. Verify behavior
- Confirm left/right trackpad swipes move the calendar in desktop admin view.
- Confirm browser back/forward no longer wins while the calendar still has horizontal room to scroll.
- Confirm vertical scrolling, mobile pull-to-refresh, and existing calendar interactions still behave normally.

Technical details
- The current global `overscroll-behavior-x: none` change is not sufficient by itself because the calendar’s Week view is built with flexible columns that shrink to fit the available width. That means there is often no true horizontal overflow for macOS trackpad gestures to scroll.
- The fix is to combine:
  1. an actual horizontal overflow container,
  2. non-shrinking desktop column widths, and
  3. wheel/trackpad interception only on that horizontal scroller.
- Expected files:
  - `src/components/calendar/JobCalendar.tsx`
  - possibly a small reusable hook/util for horizontal wheel handling
  - optionally `src/pages/admin/AdminCalendar.tsx` if the scroll wrapper belongs there