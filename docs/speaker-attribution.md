# Speaker attribution

Optional display names for the speakers a recording detects. Recognition always
labels voices `Speaker A`, `Speaker B`, …; attribution lets the user say who that
was, and only the exported label surface changes. The transcript text, the
timings and the transcript version stay exactly as the engine produced them.

## Where the user sets it

The recording panel grows a collapsed **Speaker attribution** section in its save
area, after the transcript preview:

- one text field per speaker label that the current recording actually produced,
  in first-appearance order;
- the label stays as the field's placeholder, so an empty field means "keep the
  label";
- the preview shows the attributed name while the label itself is unchanged;
- names save themselves while typing (400 ms after the last keystroke), and a
  rename typed in the last moment before the panel closes is flushed instead of
  being dropped;
- load and save failures appear inline under the section, outside the collapsed
  body, so a failure is never hidden by the section being closed.

The section renders nothing when no segment carries a speaker label.

## What changes in the exported file

Attribution is applied while the export is rendered, never by rewriting a file
afterwards, so the export stays one deterministic write of committed text.

| Format | Surface that changes |
| --- | --- |
| Markdown | the `speaker: "Speaker A"` line |
| Plain text | the `[Speaker A]` token that precedes the segment |
| SRT / VTT | the cue's label line |

`## Segment 1`, `time: 00:00:00.000 --> 00:00:12.400`, the frontmatter and every
segment's text are untouched. An export with no renames is byte-identical to an
export from before this feature existed, which is what the golden tests assert.

Names are normalised before they are stored: control characters collapse into
spaces, whitespace runs collapse, the value is trimmed, and it is capped at 60
characters. Two labels resolving to the same name block the export, because two
speakers under one name is worse than two labels.

## Where the names live

`meeting_speaker_names` in the plugin database (schema version 6, additive), one
row per meeting and label, cascading away with its meeting. Attribution is
per-meeting on purpose: the same voice can be a different person next week, and a
global name book would silently relabel old meetings.

The bundle copy of the transcript honours the same map: the participants list,
the `**Name:**` segment prefix and the frontmatter `participants` all use the
attributed name, so a summary links to a transcript that reads with names.

## Errors

| Code | Meaning | What the user sees |
| --- | --- | --- |
| `EXPORT_SPEAKER_UNKNOWN` | a name was sent for a label the committed transcript does not have | the export stops, the message names the label |
| `EXPORT_SPEAKER_INVALID` | the name is not canonical, for example with a control character | the export stops, the message names the label and never echoes the raw value |
| `EXPORT_SPEAKER_DUPLICATE` | two labels resolve to one name | the export stops, the message names the duplicate |

Validation runs after the meeting is read and before any picker, directory or
temporary file is touched, so a rejected export leaves no file behind.

## Known limitations

- The section follows the live recording's labels. A meeting opened long after it
  was recorded has no preview, so there is nothing to attribute there; stored
  names still apply to its exports and its bundle copy.
- Validation is not a version fence. A retranscription that lands between the
  check and the render can make an assignment stale; the label then prints
  unchanged rather than something wrong.
- Names are display text only. They do not prove identity, and the recording
  still distinguishes voices by label.

## Verification

- Unit: `tests/unit/speaker-attribution.spec.ts` covers normalisation, mapping,
  filtering and every problem kind; `transcript-export-renderer.spec.ts` asserts
  label-only substitution and byte identity across all four formats;
  `transcript-export-control.spec.ts` asserts the validation order and that a
  rejected map touches nothing.
- Storage: `tests/integration/speaker-name-repository.spec.ts` plus the v5→v6
  migration test in `database-migration.spec.ts`.
- RPC and panel: `tests/unit/recording-host-rpc.spec.ts`,
  `tests/client/speaker-attribution-hook.spec.ts` and
  `tests/client/recording-panel-attribution.spec.ts`.
