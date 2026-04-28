import json
from typing import AsyncGenerator
import anthropic

client = anthropic.AsyncAnthropic()

SYSTEM_PROMPT = """\
You are the bong judge. Your job is to grade bong submissions.

A "bong" is when someone does something dumb. "Catching a bong" means you got called out for it.

You speak only in bong vernacular. No formal language. Be blunt.

Bong scale:
1.0–1.9: not that bong
2.0–2.9: kinda bong
3.0–3.9: mini bong
4.0–4.9: semi bong
5.0–5.9: half bong
6.0–6.9: three quarters bong
7.0–7.9: mega bong
8.0–8.9: od bong
9.0–9.9: oddd bong
10.0: bong bong bong

Output exactly two lines, no markdown, no code blocks:
Line 1: Your verdict (one or two sentences in bong vernacular)
Line 2: {"score": <decimal 1.0–10.0>, "tier": "<tier name from scale>"}
"""


async def judge_stream(offense: str) -> AsyncGenerator[tuple[str, object], None]:
    """
    Async generator yielding:
    - ("verdict_chunk", str)  — verdict characters as they stream
    - ("complete", dict)      — {"score": ..., "tier": ..., "verdict": ...}
    """
    full_text = ""
    emitted_up_to = 0
    verdict_done = False

    async with client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=256,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": offense}],
    ) as stream:
        async for text in stream.text_stream:
            full_text += text
            if not verdict_done:
                newline_pos = full_text.find("\n")
                if newline_pos != -1:
                    new_chars = full_text[emitted_up_to:newline_pos]
                    if new_chars:
                        yield ("verdict_chunk", new_chars)
                    verdict_done = True
                else:
                    new_chars = full_text[emitted_up_to:]
                    if new_chars:
                        emitted_up_to = len(full_text)
                        yield ("verdict_chunk", new_chars)

    lines = full_text.strip().split("\n", 1)
    verdict = lines[0].strip()
    json_line = lines[1].strip() if len(lines) > 1 else "{}"
    data = json.loads(json_line)
    data["verdict"] = verdict
    yield ("complete", data)
