
import os
from dotenv import load_dotenv
from pymongo import MongoClient
import certifi

load_dotenv()

mongo_uri = os.getenv("MONGO_URI")

if not mongo_uri:
    raise ValueError("MONGO_URI не знайдено у файлі .env")

client = MongoClient(
    mongo_uri,
    tlsCAFile=certifi.where(),
    serverSelectionTimeoutMS=10000
)

try:
    # Перевіряємо доступність сервера
    client.admin.command("ping")
    print("✅ Успішне підключення до MongoDB Atlas!")
    print("Бази даних:", client.list_database_names())

except Exception as e:
    print("❌ Помилка підключення:", e)

finally:
    client.close()
