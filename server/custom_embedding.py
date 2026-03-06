import os
import requests
from typing import List, Optional, Any
from llama_index.core.embeddings import BaseEmbedding
from pydantic import Field


class GeminiRESTEmbedding(BaseEmbedding):
    """
    Custom Gemini embedding using the REST API (v1beta) directly.

    This bypasses llama_index.embeddings.gemini which uses v1beta gRPC
    and has broken model support. REST v1beta works fine.

    Supported model for this API key: gemini-embedding-001 (3072 dims)
    """

    api_key: str = Field(default="", description="Google API key")
    rest_model_name: str = Field(default="gemini-embedding-001", description="Model name without models/ prefix")

    def __init__(
        self,
        model_name: str = "gemini-embedding-001",
        api_key: Optional[str] = None,
        **kwargs: Any,
    ):
        resolved_key = api_key or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY") or ""
        clean_model = model_name.replace("models/", "")
        super().__init__(
            model_name=model_name,
            api_key=resolved_key,
            rest_model_name=clean_model,
            **kwargs,
        )

    def _embed(self, text: str) -> List[float]:
        # Use v1beta REST — v1beta gRPC (llama_index) fails, but v1beta REST works fine.
        # embedding-001 is supported in v1beta; text-embedding-004 needs extra API project access.
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
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
