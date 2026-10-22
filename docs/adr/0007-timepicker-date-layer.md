# ADR 0007: TimePicker on the Date Layer

## Status

Accepted — supersedes the TimePicker clauses of
[ADR 0005](0005-dayjs-as-the-date-layer.md) and
[ADR 0006](0006-time-locale-formatting.md).

## Context

ADR 0005 introduced dayjs as the date layer and exempted `TimePicker` as a bare
`{ h, m, s }` wall clock that does no date arithmetic. That exemption was a scoping shortcut taken
when dayjs was introduced, not a separate review of TimePicker: the migration covered `DatePicker`
and `Countdown`, and the wall-clock argument was applied to TimePicker without examining its
hand-written formatter or the `format` contract the other components were moving to. ADR 0006
reaffirmed the exemption when `Time` started formatting its date capsule with dayjs. The
exemption was therefore an incomplete result of the dayjs migration, not a considered position
on `format`.

The exemption left `TimePicker` as the only time component with hand-written parsing and
formatting. The divergence was visible in the public API: `TimePicker.format` accepted only
the three placeholders `HH` / `mm` / `ss`, and each was expanded once by `String.replace`,
while `DatePicker.format` and `Time.weekdayFormat` / `dateFormat` accept dayjs core tokens.
The same prop name therefore meant two different languages, and a caller could not write
`h:mm A` or `[此刻] HH:mm` on a time picker.

The wall-clock argument justifies keeping the **value** date-free; it does not require the
**implementation** to re-implement time parsing and formatting. Those are formatting concerns
with the same edge cases the date layer exists to remove.

## Decision

- **dayjs parses, formats and serializes the time.** The public value stays a plain
  `HH:mm:ss` string and `TimePart` keeps its shape; no date enters the value or the callback.
- **Formatting runs on a fixed anchor date, `2000-01-01`.** The anchor is an implementation
  detail, not part of the value. It is fixed rather than "today" because formatting on the
  host's current date would move `02:30` to `03:30` on a spring-forward day — the exact
  daylight-saving failure ADR 0005 called out.
- **`format` follows dayjs core tokens**, the same contract as `DatePicker` and `Time`:
  `HH` / `mm` / `ss` / `h` / `A` render, `[literal]` escapes, and plugin-owned tokens stay
  literal. Only time tokens are meaningful; a date token renders the anchor date, which the
  prop documentation and the design-system docs state explicitly. `ss` still controls whether
  the seconds column is shown.
- **Parsing stays lenient about the old accepted inputs.** Strict `customParseFormat` parsing
  runs over every combination of 1- or 2-digit hour / minute / second and an optional seconds
  field, so `9:8:7`, `09:08`, and `09:08:07` all parse as before, while `24:00:00` and
  `09:60:00` are rejected.
- **Plugins are registered locally; no global locale.** The module extends
  `customParseFormat` and never calls `dayjs.locale(...)`.

## Consequences

- Consumers who import only `TimePicker` now pull dayjs and `customParseFormat` (about
  6 kB gzipped combined, of which dayjs is about 3.6 kB); `preserveModules` still drops both
  for consumers who import no date or time component.
- The `format` contract broadens. Documented tokens render exactly as before, but core tokens
  that used to pass through as literal text now interpolate; date tokens show the anchor date
  rather than the literal token. Plugin-owned tokens remain literal. This is a documented
  behaviour change, in the same class as the `DatePicker.format` expansion in ADR 0005.
- `TimePicker` no longer hand-rolls time parsing or formatting; the "wall-clock values stay
  out of it" exception in ADR 0005 is retired. The value is still date-free and still does no
  date arithmetic, comparison, or time-zone conversion.
- The anchor date is not configurable. A caller who needs a date in the output wants
  `DatePicker`, not this component.

## Related

- Supersedes the `TimePicker` clause of
  [ADR 0005](0005-dayjs-as-the-date-layer.md) and the "TimePicker decisions remain in force"
  clause of [ADR 0006](0006-time-locale-formatting.md).
- dayjs bundling and token guarantees: [ADR 0005](0005-dayjs-as-the-date-layer.md).
- `Time`'s date capsule: [ADR 0006](0006-time-locale-formatting.md).
