
# Spotify Analytics — MongoDB

## 1. Опис проєкту

У цій роботі я використав датасет Spotify Tracks Dataset із Kaggle. Завантажив дані в MongoDB Atlas, змінив структуру документів, написав запити та перевірив роботу індексів.

Датасет: [Spotify Tracks Dataset](https://www.kaggle.com/datasets/maharshipandya/-spotify-tracks-dataset)

Використовував Python, Pandas, PyMongo, MongoDB Atlas та mongosh.

## 2. Налаштування та запуск

Для запуску потрібно створити кластер MongoDB Atlas, додати користувача бази даних та дозволити підключення зі своєї IP-адреси.

У корені проєкту створити `.env`:

```dotenv
MONGO_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/
```

Встановити залежності:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Завантажити `dataset.csv` із Kaggle в папку `data/`.

Запустити скрипти в такому порядку:

```bash
python scripts/01_load_data.py
```

Для наступних скриптів потрібен `mongosh`. Після налаштування змінної `MONGO_URI` у терміналі:

```bash
mongosh "$MONGO_URI" --file scripts/02_transform.js
mongosh "$MONGO_URI" --file queries/part2_queries.js
mongosh "$MONGO_URI" --file queries/part3_indexes.js
```

## 3. Частина 1. Завантаження та схема даних

Завантажив 114 000 рядків із CSV. Після видалення записів без назви треку або виконавця в колекцію `tracks_raw` потрапило **113 999 документів**.

Через Aggregation Pipeline створив колекцію `tracks` із такою ж кількістю документів.

Під час трансформації:
- `artists` перетворив із рядка на масив;
- аудіохарактеристики об'єднав в `audio_features`;
- додав `duration_sec` та `popularity_tier`;
- видалив зайві поля.

### Приклад документа

```json
{
  "track_name": "Comedy",
  "artists": ["Gen Hoshino"],
  "popularity": 73,
  "popularity_tier": "high",
  "duration_ms": 230666,
  "duration_sec": 230.7,
  "track_genre": "acoustic",
  "audio_features": {
    "danceability": 0.676,
    "energy": 0.461,
    "loudness": -6.746,
    "speechiness": 0.143,
    "acousticness": 0.0322,
    "instrumentalness": 0.00000101,
    "liveness": 0.358,
    "valence": 0.715,
    "tempo": 87.917,
    "key": 1,
    "mode": 0,
    "time_signature": 4
  }
}
```

### Теоретичні питання

**1. Чому аудіохарактеристики винесені в `audio_features`?**

Тому що вони всі описують властивості одного треку. Так документ виглядає більш структурованим і зрозумілим.

Наприклад, для пошуку за енергією можна використовувати `audio_features.energy`.

Таке вкладення зручне, коли поля пов'язані між собою. Але якщо потрібно експортувати дані в таблицю або часто змінювати окремі поля, плоска структура може бути простішою.

**2. Чому виконавці зберігаються як масив?**

Тому що один трек може мати кількох виконавців. Наприклад, `"Drake; Future"` перетворюється на `["Drake", "Future"]`.

З масивом простіше шукати треки конкретного виконавця. Також можна використовувати `$all` для пошуку за кількома артистами, `$size` для перевірки кількості виконавців і `$unwind` для групування за артистами.

## 4. Частина 2. Запити до даних

Усі запити знаходяться у файлі `queries/part2_queries.js`.

### Завдання 1. Треки для вечірки

Шукав треки з `danceability > 0.7`, `energy > 0.7` і тривалістю від 3 до 5 хвилин.

Використав `find()`, `$gt`, `$gte` та `$lte`.

**Результат: 7 311 треків.**

### Завдання 2. Популярні виконавці

Шукав артистів, у яких мінімум 3 треки та популярність кожного не менше 60.

Використав `$unwind`, `$group`, `$match`, `$sort` та `$limit`.

Топ-5 за середньою популярністю:

| Виконавець | Треків | Мін. популярність | Середня |
|---|---:|---:|---:|
| Harry Styles | 3 | 89 | 92.0 |
| Luar La L | 4 | 90 | 90.5 |
| Olivia Rodrigo | 5 | 86 | 87.4 |
| BYOR | 4 | 87 | 87.0 |
| IVE | 3 | 79 | 84.0 |

### Завдання 3. Нетипові треки

Для кожного жанру розрахував середній темп через `$avg` та стандартне відхилення через `$stdDevPop`.

Поріг визначав за формулою:

`outlier_threshold = avg_tempo + 2 * stdDev`

Через `$lookup` отримав масив треків, темп яких перевищує поріг.

Наприклад, для жанру `acoustic` середній темп становить 119 BPM, а поріг — 178.5 BPM. Трек *Can't Help Falling In Love* із темпом 181.74 BPM потрапив до результату.

### Завдання 4. Треки для фонової роботи

Шукав треки за умовами:

- `loudness < -10`
- `speechiness < 0.1`
- `instrumentalness > 0.5`
- `explicit = false`

Використав `find()` з операторами `$lt` та `$gt`.

**Результат: 9 324 треки.**

## 5. Частина 3. Індекси та оптимізація

### Завдання 1. Індекс для жанру та danceability

Створив складений індекс:

```javascript
{
  track_genre: 1,
  "audio_features.danceability": 1,
  popularity: -1
}
```

Перевірив запит через `explain("executionStats")`.

| Показник | Без індексу | З індексом |
|---|---:|---:|
| Час виконання | 83 мс | 1 мс |
| `totalDocsExamined` | 113999 | 354 |
| `totalKeysExamined` | 0 | 354 |
| План | COLLSCAN | IXSCAN |

Після створення індексу MongoDB перевіряла лише 354 документи замість усієї колекції.

Використання індексу підтверджується стадією `IXSCAN` та полем `indexName: idx_genre_danceability_popularity`.

При цьому `SORT` залишився, оскільки індекс не повністю забезпечує потрібне сортування.

### Завдання 2. Індекс для фонової музики

Створив індекс:

```javascript
{
  explicit: 1,
  "audio_features.instrumentalness": 1,
  "audio_features.speechiness": 1
}
```

Порівняв виконання запиту з індексом та без нього.

| Показник | Без індексу | З індексом |
|---|---:|---:|
| Час виконання | 153 мс | 78 мс |
| `totalDocsExamined` | 113999 | 16141 |
| `totalKeysExamined` | 0 | 16602 |
| План | COLLSCAN | IXSCAN |

MongoDB самостійно використала індекс `idx_background_music`, що видно в `explain()`.

### Завдання 3. Covered Query

Початковий запит:

```javascript
db.tracks.find({
  track_genre: "pop",
  popularity: { $gte: 70 }
});
```

**Цей запит не є покривним**, тому що `find()` повертає всі поля документа, а індекс містить лише частину з них.

У `explain()` отримав:
- `totalDocsExamined: 317`
- `totalKeysExamined: 620`
- План: `IXSCAN` + `FETCH`

Після додавання проєкції:

```javascript
db.tracks.find(
  {
    track_genre: "pop",
    popularity: { $gte: 70 }
  },
  {
    _id: 0,
    track_genre: 1,
    popularity: 1
  }
);
```

Отримав:
- `totalDocsExamined: 0`
- `totalKeysExamined: 620`
- План: `IXSCAN` + `PROJECTION_COVERED`

Тобто другий запит став покривним, оскільки MongoDB змогла отримати необхідні дані безпосередньо з індексу, не читаючи документи колекції.

Перевірку виконував через `explain()` із `.hint()` для створеного індексу.
