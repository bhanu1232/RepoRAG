import os
import requests
from typing import List, Optional, Any
from llama_index.core.embeddings import BaseEmbedding
from pydantic import Field


class GeminiRESTEmbedding(BaseEmbedding):
    """
    Custom Gemini embedding that calls the REST API v1 directly.

    This bypasses llama_index.embeddings.gemini which is hardcoded to use
    the v1beta gRPC endpoint — which does NOT support embedContent for any model.

    Uses: https://generativelanguage.googleapis.com/v1/models/{model}:embedContent
    """

    api_key: str = Field(default="", description="Google API key")
    rest_model_name: str = Field(default="text-embedding-004", description="Model name without 'models/' prefix")

    def __init__(
        self,
        model_name: str = "text-embedding-004",
        api_key: Optional[str] = None,
        **kwargs: Any,
    ):
        resolved_key = api_key or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY") or ""
        # Strip "models/" prefix if passed, we handle it ourselves
        clean_model = model_name.replace("models/", "")
        super().__init__(
            model_name=model_name,
            api_key=resolved_key,
            rest_model_name=clean_model,
            **kwargs,
        )

    def _embed(self, text: str) -> List[float]:
        """Call Google REST API v1 to get embedding for text."""
        url = (
            f"https://generativelanguage.googleapis.com/v1/models/"
            f"{self.rest_model_name}:embedContent"
        )
        payload = {
            "model": f"models/{self.rest_model_name}",
            "content": {
                "parts": [{"text": text}]
            },
        }
        response = requests.post(
            url,
            json=payload,
            params={"key": self.api_key},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()["embedding"]["values"]

    def _get_query_embedding(self, query: str) -> List[float]:
        return self._embed(query)

    def _get_text_embedding(self, text: str) -> List[float]:
        return self._embed(text)

    def _get_text_embeddings(self, texts: List[str]) -> List[List[float]]:
        return [self._embed(t) for t in texts]

    async def _aget_query_embedding(self, query: str) -> List[float]:
        return self._embed(query)

    async def _aget_text_embedding(self, text: str) -> List[float]:
        return self._embed(text)
