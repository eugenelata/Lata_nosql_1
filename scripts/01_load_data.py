
import os
import pandas as pd
import certifi

from pathlib import Path
from pymongo import MongoClient
from tqdm import tqdm
from dotenv import load_dotenv

# Шлях до кореневої папки проєкту
BASE_DIR = Path(__file__).resolve().parent.parent

# Завантажуємо змінні середовища
load_dotenv(BASE_DIR / ".env")

MONGO_URI = os.environ["MONGO_URI"]
DB_NAME = "spotify"
CSV_PATH = BASE_DIR / "data" / "dataset.csv"
BATCH_SIZE = 1000

# Підключаємося до MongoDB Atlas
client = MongoClient(
    MONGO_URI,
    tlsCAFile=certifi.where(),
    serverSelectionTimeoutMS=10000
)

db = client[DB_NAME]

# Видаляємо попередню колекцію для повторного запуску
db["tracks_raw"].drop()

# Читаємо CSV
df = pd.read_csv(CSV_PATH)

print(f"Завантажуємо {len(df)} треків...")

# Приводимо типи даних
df["explicit"] = df["explicit"].astype(bool)

int_cols = [
    "popularity",
    "duration_ms",
    "key",
    "mode",
    "time_signature"
]

for col in int_cols:
    df[col] = df[col].astype(int)

float_cols = [
    "danceability",
    "energy",
    "loudness",
    "speechiness",
    "acousticness",
    "instrumentalness",
    "liveness",
    "valence",
    "tempo"
]

for col in float_cols:
    df[col] = df[col].astype(float)

# Прибираємо записи без виконавця або назви
query = df["artists"].isna() | df["track_name"].isna()

records = df[~query].to_dict("records")

# Завантажуємо документи партіями по 1000
for i in tqdm(range(0, len(records), BATCH_SIZE)):
    db["tracks_raw"].insert_many(
        records[i:i + BATCH_SIZE]
    )

print(
    f"Завантажено документів: "
    f"{db['tracks_raw'].count_documents({})}"
)

print("Приклад документа:")
print(db["tracks_raw"].find_one())

client.close()
