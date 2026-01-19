import os
from pinecone import Pinecone
from dotenv import load_dotenv

load_dotenv()

pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))

print("Existing indexes:")
for index_model in pc.list_indexes():
    print(f"- Name: {index_model.name}, Dimension: {index_model.dimension}, Metric: {index_model.metric}")
