import os
from pinecone import Pinecone
from dotenv import load_dotenv

load_dotenv()

pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))

print("Deleting all indexes...")
for index_model in pc.list_indexes():
    print(f"Deleting {index_model.name}...")
    pc.delete_index(index_model.name)

print("All indexes deleted.")
