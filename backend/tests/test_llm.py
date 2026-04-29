import pytest
from unittest.mock import AsyncMock, MagicMock
from app.llm import judge_stream


def make_mock_stream(text_chunks: list[str]):
    """Build a mock Anthropic stream whose text_stream yields the given chunks."""
    async def _text_stream():
        for chunk in text_chunks:
            yield chunk

    mock_stream = MagicMock()
    mock_stream.text_stream = _text_stream()
    mock_stream.__aenter__ = AsyncMock(return_value=mock_stream)
    mock_stream.__aexit__ = AsyncMock(return_value=False)
    return mock_stream


class TestJudgeStream:
    async def test_streams_verdict_chunks(self, mocker):
        chunks = ["deadass ", "od bong", "\n", '{"score": 8.2, "tier": "od bong"}']
        mocker.patch("app.llm.client.messages.stream", return_value=make_mock_stream(chunks))

        results = []
        async for event_type, value in judge_stream("did something dumb"):
            results.append((event_type, value))

        verdict_chunks = [(t, v) for t, v in results if t == "verdict_chunk"]
        assert len(verdict_chunks) > 0
        assert all(t == "verdict_chunk" for t, _ in verdict_chunks)

    async def test_parses_score_and_tier(self, mocker):
        chunks = ["mega bong bro\n", '{"score": 7.5, "tier": "mega bong"}']
        mocker.patch("app.llm.client.messages.stream", return_value=make_mock_stream(chunks))

        result = None
        async for event_type, value in judge_stream("something dumb"):
            if event_type == "complete":
                result = value

        assert result is not None
        assert result["score"] == 7.5
        assert result["tier"] == "mega bong"
        assert "mega bong bro" in result["verdict"]

    async def test_verdict_text_does_not_include_json_line(self, mocker):
        chunks = ["kinda bong\n", '{"score": 2.3, "tier": "kinda bong"}']
        mocker.patch("app.llm.client.messages.stream", return_value=make_mock_stream(chunks))

        result = None
        async for event_type, value in judge_stream("minor infraction"):
            if event_type == "complete":
                result = value

        assert result is not None
        assert '{"score"' not in result["verdict"]
