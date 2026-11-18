
db = db.getSiblingDB("spotify");

// Частина 2. Завдання 1: Треки для вечірки

print("=== Треки для вечірки ===");

const partyFilter = {
  "audio_features.danceability": { $gt: 0.7 },
  "audio_features.energy": { $gt: 0.7 },
  duration_ms: { $gte: 180000, $lte: 300000 }
};


print("Знайдено треків: " + db.tracks.countDocuments(partyFilter));


db.tracks.find(
  partyFilter,
  {
    _id: 0,
    track_name: 1,
    artists: 1,
    duration_ms: 1,
    "audio_features.danceability": 1,
    "audio_features.energy": 1
  }
).limit(5).forEach(printjson);


print("\n=== Завдання 2. Популярні виконавці ===");

db.tracks.aggregate([
  // 1. Розгортаємо масив виконавців
  {
    $unwind: "$artists"
  },

  // 2. Групуємо треки за виконавцем
  {
    $group: {
      _id: "$artists",
      track_count: { $sum: 1 },
      min_popularity: { $min: "$popularity" },
      avg_popularity: { $avg: "$popularity" }
    }
  },

  // 3. Відбираємо артистів за умовами
  {
    $match: {
      track_count: { $gte: 3 },
      min_popularity: { $gte: 60 }
    }
  },

  // 4. Формуємо результат
  {
    $project: {
      _id: 0,
      artist: "$_id",
      track_count: 1,
      min_popularity: 1,
      avg_popularity: {
        $round: ["$avg_popularity", 1]
      }
    }
  },

  // 5. Сортуємо за середньою популярністю
  {
    $sort: {
      avg_popularity: -1,
      track_count: -1,
      artist: 1
    }
  },

  // 6. Показуємо топ-20
  {
    $limit: 20
  }
]).forEach(printjson);


print("\n=== Завдання 3. Нетипові треки ===");

db.tracks.aggregate([
  // 1. Обчислюємо статистику для кожного жанру
  {
    $group: {
      _id: "$track_genre",
      avg_tempo: { $avg: "$audio_features.tempo" },
      std_tempo: { $stdDevPop: "$audio_features.tempo" }
    }
  },

  // 2. Обчислюємо поріг нетипового темпу
  {
    $project: {
      _id: 0,
      genre: "$_id",
      avg_tempo: { $round: ["$avg_tempo", 1] },
      outlier_threshold: {
        $add: [
          "$avg_tempo",
          { $multiply: [2, "$std_tempo"] }
        ]
      }
    }
  },

  // 3. Шукаємо треки, які перевищують поріг
  {
    $lookup: {
      from: "tracks",
      let: {
        genre_name: "$genre",
        threshold: "$outlier_threshold"
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$track_genre", "$$genre_name"] },
                { $gt: ["$audio_features.tempo", "$$threshold"] }
              ]
            }
          }
        },
        {
          $project: {
            track_name: 1,
            popularity: 1,
            artists: 1,
            "audio_features.tempo": 1
          }
        }
      ],
      as: "outlier_tracks"
    }
  },

  // 4. Округлюємо поріг до одного знака
  {
    $project: {
      genre: 1,
      avg_tempo: 1,
      outlier_threshold: {
        $round: ["$outlier_threshold", 1]
      },
      outlier_tracks: 1
    }
  },

  // 5. Прибираємо жанри без нетипових треків
  {
    $match: {
      "outlier_tracks.0": { $exists: true }
    }
  },

  // 6. Сортуємо за назвою жанру
  {
    $sort: { genre: 1 }
  }
]).forEach(printjson);

print("\n=== Завдання 4. Треки для фонової роботи ===");

// Умови пошуку
const backgroundFilter = {
  "audio_features.loudness": { $lt: -10 },
  "audio_features.speechiness": { $lt: 0.1 },
  "audio_features.instrumentalness": { $gt: 0.5 },
  explicit: false
};

// Підрахунок кількості треків
print(
  "Знайдено треків: " +
  db.tracks.countDocuments(backgroundFilter)
);

// Виводимо перші 5 треків
db.tracks.find(
  backgroundFilter,
  {
    _id: 0,
    track_name: 1,
    artists: 1,
    track_genre: 1,
    explicit: 1,
    "audio_features.loudness": 1,
    "audio_features.speechiness": 1,
    "audio_features.instrumentalness": 1
  }
).limit(5).forEach(printjson);
