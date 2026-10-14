# Feedback for Nebius Token Factory

Items found by reading the docs while building Awas. Behaviour observed on live calls will be added after the benchmark run.

1. **`response_format` contradicts itself in the docs.** The chat-completion API reference says only `json_object` or `text` are accepted; the structured-output guide shows `json_schema`. Which is supported for `nvidia/nemotron-3-super-120b-a12b` is not stated on either page.
2. **Indonesian is not a listed language** on the Nemotron 3 Super model card (it lists English, French, German, Italian, Japanese, Spanish and Chinese; the Lightning and Ultra cards were not re-checked), although Token Factory is marketed to builders worldwide.
