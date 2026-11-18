
db = db.getSiblingDB("spotify");

print("\n=== Завдання 1. Аналіз без індексу ===");

// Запит із домашнього завдання
const filter = {
  track_genre: "pop",
  "audio_features.danceability": { $gte: 0.7 }
};

const sort = { popularity: -1 };

// Перевіряємо наявні індекси
print("\nНаявні індекси:");
printjson(db.tracks.getIndexes());

// Аналізуємо виконання запиту
const before = db.tracks
  .find(filter)
  .sort(sort)
  .explain("executionStats");

// Виводимо основні показники
print("\nСтатистика ДО індексації:");

printjson({
  nReturned: before.executionStats.nReturned,
  executionTimeMillis: before.executionStats.executionTimeMillis,
  totalDocsExamined: before.executionStats.totalDocsExamined,
  totalKeysExamined: before.executionStats.totalKeysExamined
});

// План виконання
print("\nПлан виконання:");
printjson(before.queryPlanner.winningPlan);


print("\n=== Створення індексу ===");

db.tracks.createIndex(
  {
    track_genre: 1,
    "audio_features.danceability": 1,
    popularity: -1
  },
  {
    name: "idx_genre_danceability_popularity"
  }
);

print("\nІндекси після створення:");
printjson(db.tracks.getIndexes());

print("\n=== Аналіз ПІСЛЯ індексації ===");

// Виконуємо той самий запит
const after = db.tracks
  .find(filter)
  .sort(sort)
  .hint("idx_genre_danceability_popularity")
  .explain("executionStats");

// Виводимо статистику
print("\nСтатистика ПІСЛЯ індексації:");

printjson({
  nReturned: after.executionStats.nReturned,
  executionTimeMillis: after.executionStats.executionTimeMillis,
  totalDocsExamined: after.executionStats.totalDocsExamined,
  totalKeysExamined: after.executionStats.totalKeysExamined
});

// Перевіряємо план виконання
print("\nПлан виконання ПІСЛЯ:");
printjson(after.queryPlanner.winningPlan);


print("\n=== Перевірка без hint() ===");

const automatic = db.tracks
  .find(filter)
  .sort(sort)
  .explain("executionStats");

printjson({
  nReturned: automatic.executionStats.nReturned,
  executionTimeMillis: automatic.executionStats.executionTimeMillis,
  totalDocsExamined: automatic.executionStats.totalDocsExamined,
  totalKeysExamined: automatic.executionStats.totalKeysExamined
});

print("\nАвтоматично обраний план:");
printjson(automatic.queryPlanner.winningPlan);

print("\n=== Завдання 2. Індекс для фонової музики ===");

// 1. Створюємо складений індекс
db.tracks.createIndex(
  {
    explicit: 1,
    "audio_features.instrumentalness": 1,
    "audio_features.speechiness": 1
  },
  {
    name: "idx_background_music"
  }
);

// 2. Запит для пошуку фонової музики
const workFilter = {
  explicit: false,
  "audio_features.instrumentalness": { $gt: 0.5 },
  "audio_features.speechiness": { $lt: 0.1 }
};

// 3. Аналізуємо запит без примусового hint()
const workExplain = db.tracks
  .find(workFilter)
  .explain("executionStats");

// 4. Виводимо статистику
print("\nСтатистика запиту:");

printjson({
  nReturned: workExplain.executionStats.nReturned,
  executionTimeMillis: workExplain.executionStats.executionTimeMillis,
  totalDocsExamined: workExplain.executionStats.totalDocsExamined,
  totalKeysExamined: workExplain.executionStats.totalKeysExamined
});

// 5. Перевіряємо план виконання
print("\nПлан виконання:");
printjson(workExplain.queryPlanner.winningPlan);



print("\n=== Завдання 3. Covered Query ===");

// 1. Початковий запит без проєкції
const originalQuery = db.tracks
  .find({
    track_genre: "pop",
    popularity: { $gte: 70 }
  })
  .hint("idx_genre_danceability_popularity")
  .explain("executionStats");

print("\nПочатковий запит:");
printjson({
  nReturned: originalQuery.executionStats.nReturned,
  totalDocsExamined: originalQuery.executionStats.totalDocsExamined,
  totalKeysExamined: originalQuery.executionStats.totalKeysExamined
});

printjson(originalQuery.queryPlanner.winningPlan);

// 2. Запит із проєкцією
const coveredQuery = db.tracks
  .find(
    {
      track_genre: "pop",
      popularity: { $gte: 70 }
    },
    {
      _id: 0,
      track_genre: 1,
      popularity: 1
    }
  )
  .hint("idx_genre_danceability_popularity")
  .explain("executionStats");

print("\nЗапит із проєкцією:");
printjson({
  nReturned: coveredQuery.executionStats.nReturned,
  totalDocsExamined: coveredQuery.executionStats.totalDocsExamined,
  totalKeysExamined: coveredQuery.executionStats.totalKeysExamined
});

printjson(coveredQuery.queryPlanner.winningPlan);


print("\n=== Завдання 2. Порівняння без індексу ===");

// Використовуємо фільтр із завдання 2
const withoutBackgroundIndex = db.tracks
  .find(workFilter)
  .hint({ $natural: 1 })
  .explain("executionStats");

printjson({
  nReturned: withoutBackgroundIndex.executionStats.nReturned,
  executionTimeMillis:
    withoutBackgroundIndex.executionStats.executionTimeMillis,
  totalDocsExamined:
    withoutBackgroundIndex.executionStats.totalDocsExamined,
  totalKeysExamined:
    withoutBackgroundIndex.executionStats.totalKeysExamined
});

print("\nПлан виконання без індексу:");
printjson(withoutBackgroundIndex.queryPlanner.winningPlan);
