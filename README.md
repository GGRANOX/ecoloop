# ECOLOOP — AI Smart Waste Sorting System

> **Small Actions. Big Impact.** — Smart AI technology for a cleaner and greener planet.

Сайт определяет по фото, **пластик** это или **бумага**, и показывает, как три академических алгоритма —
**Bayes**, **MDP** и **A\*** — участвуют в принятии решения:

```
фото ─► CNN (MobileNetV2) ─► Bayes (prior × likelihood → posterior) ─► MDP (value iteration → действие) ─► A* (маршрут робота к контейнеру)
```

Все три алгоритма реально считаются в Python (`backend/algorithms/*.py`) и влияют на итоговое решение:
низкая уверенность после Bayes → MDP выбирает `Inspect_Again` → маршрута нет; высокая → `Sort_*` → A* строит путь.

---

## Быстрый старт

Python 3.10+.

```bash
pip install -r requirements.txt
```

```bash
uvicorn backend.main:app --reload
```

Откройте <http://127.0.0.1:8000> — фронтенд отдаётся самим FastAPI. Swagger-документация API: <http://127.0.0.1:8000/docs>.

Тесты (30 шт.: A*, Bayes, MDP, API):

```bash
python -m pytest -q
```

### Режимы классификатора: `demo` и `model`

| Режим | Когда | Что анализирует фото |
|---|---|---|
| **DEMO** | нет файла весов `backend/ml/model/ecoloop_mobilenetv2.pt` или не установлен PyTorch | честный простой классификатор на признаках цвета и текстуры (`backend/ml/demo_features.py`): отделение объекта от фона, блики, насыщенные цвета, коричневые/бежевые тона картона, матовые светлые участки, резкость краёв → логистическая функция. Никаких случайных чисел. |
| **MODEL** | веса есть и установлен PyTorch | MobileNetV2 (transfer learning), softmax по двум классам; матрица ошибок с валидации используется как likelihood в Bayes |

Режим проверяется при каждом запросе: как только `train.py` положит веса, API сам переключится на `"mode": "model"` (без перезапуска). На UI режим показан бейджем DEMO / MODEL, в JSON — полем `mode`.

> `requirements.txt` содержит только то, что нужно для работы сайта (так проект запускается быстро и деплоится на Vercel).
> PyTorch нужен для обучения и режима MODEL: `pip install -r requirements-ml.txt`.

---

## Обучение модели

**Почему PyTorch, а не TensorFlow:** у `torchvision` есть готовая MobileNetV2 с весами ImageNet, обучение пишется явным циклом
(видно каждый шаг — удобно объяснять на защите), CPU-сборка легче, а инференс — это 5 строк кода. MobileNetV2 выбрана, потому что
она маленькая (~3.5 млн параметров), быстро дообучается на CPU и хорошо переносит признаки ImageNet на фото мусора.

1. Установите ML-зависимости:

   ```bash
   pip install -r requirements-ml.txt
   ```

2. Скачайте датасет **TrashNet** (Gary Thung & Mindy Yang, Stanford): <https://github.com/garythung/trashnet>
   (архив `dataset-resized.zip`, ~40 МБ; классы cardboard, glass, metal, paper, plastic, trash).
   Также есть зеркало на Hugging Face: <https://huggingface.co/datasets/garythung/trashnet>.
   Альтернатива — Kaggle "Waste Classification" / "Garbage Classification" (нужны папки `plastic` и `paper`).

3. Распакуйте так, чтобы были папки:

   ```
   data/trashnet/plastic/*.jpg   (~480 фото)
   data/trashnet/paper/*.jpg     (~590 фото)
   ```

   Остальные классы игнорируются.

4. Обучите:

   ```bash
   python -m backend.ml.train --data data/trashnet --epochs 8
   ```

   Скрипт: стратифицированный train/val split 80/20, аугментации (RandomResizedCrop, flip, rotation, ColorJitter),
   заморозка ранних блоков MobileNetV2 + дообучение последних блоков и новой головы (AdamW, cosine LR).
   После каждой эпохи печатает loss и val accuracy, в конце — confusion matrix; сохраняет лучшие веса
   `backend/ml/model/ecoloop_mobilenetv2.pt` и `meta.json` (точность, матрица ошибок со сглаживанием Лапласа).
   На CPU ~1–3 минуты на эпоху. При первом запуске torchvision скачает веса ImageNet (~14 МБ).

Флаг `--no-pretrained` — офлайн smoke-тест без ImageNet-весов (точность будет низкой).

---

## API

Единый формат ошибок: `{"error": {"code": "...", "message": "..."}}`.

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/health` | статус и режим (`demo`/`model`), метаданные модели |
| POST | `/api/analyze` | multipart: `file` (JPG/PNG/WEBP, ≤ 5 МБ), опционально `gamma` (0–0.99), `prior_plastic` (0.01–0.99). Возвращает всё одним JSON |
| POST | `/api/bayes` | `{prior_plastic, likelihood_plastic, likelihood_paper}` → prior, likelihood, joint, P(E), posterior, шаги расчёта |
| POST | `/api/mdp` | `{posterior_plastic, prior_plastic, gamma, inspect_success, verified_accuracy}` → V, Q, политика, итерации, дельты |
| POST | `/api/astar` | `{width, height, start, goal, obstacles}` → path, steps, closed (порядок раскрытия), open |
| GET | `/api/astar/default` | раскладка склада 12×8 (старт робота, контейнеры, препятствия) |

Ответ `/api/analyze` (сокращённо):

```json
{
  "mode": "demo",
  "classification": {"label": "plastic", "probabilities": {"plastic": 0.99, "paper": 0.01}, "details": {...}},
  "bayes": {"prior": {...}, "likelihood": {...}, "evidence": 0.47, "posterior": {...}, "steps": [...]},
  "mdp": {"current_state": "MaterialIdentified", "action": "Sort_Plastic", "Q": {...}, "policy": {...}, "iterations": 11},
  "path": {"found": true, "path": [[0,4], ...], "steps": 16, "closed": [...], "open": [...]},
  "decision": {"material": "plastic", "bin": "Yellow container — PLASTIC", "explanation": "..."}
}
```

Ошибки ввода: не изображение → 415 `unsupported_type`; > 5 МБ → 413 `file_too_large`; битый файл → 400 `invalid_image`; пустой → 400 `empty_file`.

---

## Как устроены алгоритмы

**Bayes** (`bayes.py`). `P(C|E) = P(E|C)·P(C) / P(E)`, `P(E) = Σ P(E|Cᵢ)·P(Cᵢ)`.
Prior по умолчанию: 45% пластика / 55% бумаги (доля предметов в типичном бытовом контейнере для вторсырья — это настраиваемое допущение).
Likelihood получается из выхода классификатора и его надёжности: `P(E|C=c) = Σₖ qₖ · M[c][k]`, где `q` — softmax модели,
`M[c][k] = P(модель говорит k | истинный класс c)` — матрица ошибок с валидации (в DEMO — 0.9/0.1). Неуверенный выход (q≈0.5) — слабое свидетельство.

**MDP** (`mdp.py`). Состояния: `ItemDetected, MaterialIdentified, LowConfidence, ReadyToSort, Sorted` (терминальное).
Действия: `Sort_Plastic, Sort_Paper, Inspect_Again`. Награды: верная сортировка +10, ошибка −10, повторный осмотр −1
(ожидаемая награда сортировки = 10·P(верно) − 10·P(ошибка)). `Inspect_Again` из MaterialIdentified/LowConfidence с вероятностью
0.8 переводит в ReadyToSort, где точность 95%. Value iteration до `max|ΔV| < 1e-6`.
При γ = 0.9 сортировать выгоднее, только если уверенность ≳ 83%; при меньшем γ робот «нетерпеливее» и сортирует раньше.

**A\*** (`astar.py`). Сетка 12×8, 4-связность, `f = g + h`, `h` — манхэттенское расстояние (допустимая и согласованная эвристика → оптимальный путь),
open list — бинарная куча, closed list — множество; если open list опустел — «путь не найден».

---

## Структура

```
backend/
  main.py            FastAPI: роуты, CORS, обработчики ошибок, логирование, StaticFiles
  schemas.py         Pydantic-модели
  pipeline.py        CNN → Bayes → MDP → A*
  algorithms/        astar.py, bayes.py, mdp.py
  ml/                train.py, classifier.py, demo_features.py, model/ (веса)
frontend/            index, sorting, lab, games, profile, about (.html) + css/ + js/ (ES modules, Canvas)
tests/               pytest: test_algorithms.py, test_api.py
api/index.py         точка входа для Vercel
```

Фронтенд — чистые HTML/CSS/JS (ES-модули), без фреймворков и внешних картинок: все иллюстрации — inline SVG / Canvas.
Профиль, очки, уровни и достижения хранятся в `localStorage`.

## Деплой (Vercel)

`vercel.json` отдаёт `frontend/` как статику, а `/api/*` и `/docs` — в serverless-функцию `api/index.py` (тот же FastAPI-app).
PyTorch слишком велик для serverless-функции, поэтому **на Vercel сайт всегда работает в режиме DEMO**; режим MODEL — при локальном запуске с обученными весами.

```bash
vercel deploy --prod
```

---

## Сценарий демонстрации (3–5 минут)

1. **Home (30 с).** Слоган, проблема: 9% пластика перерабатывается, ~25% загрязнения в контейнерах. Пайплайн из 4 шагов: CNN → Bayes → MDP → A*.
2. **AI Sorting (1.5 мин).** Загрузить фото пластиковой бутылки (или образец «Blue bottle»). Показать бейдж режима, вероятности, уверенность, контейнер.
   Прокрутить к «Decision chain»: числа Bayes (prior, likelihood, P(E), posterior), Q-значения MDP и выбранное действие, анимация A*.
   Затем загрузить неоднозначное фото (образец «Newspaper»): уверенность низкая → MDP выбирает **Inspect Again**, маршрута нет. Это ключевой момент: алгоритмы реально меняют решение.
   В «Advanced settings» уменьшить γ до 0.3 и повторить — робот становится «нетерпеливым» и сортирует.
3. **Algorithms Lab (1.5 мин).**
   *A\**: поставить пару стен, Run — видно закрытые/открытые клетки и путь; замуровать контейнер — «No path found».
   *Bayes*: двигать prior — posterior меняется, сумма всегда 1.000000.
   *MDP*: двигать posterior от 0.55 к 0.95 — действие переключается с Inspect Again на Sort; график сходимости value iteration.
4. **Games (30 с).** Tic-Tac-Toe на Hard (minimax — выиграть нельзя), бросок в Bottle Toss.
5. **Profile (15 с).** Очки, уровень, достижения, рекорды.
6. **Вопросы.** Честно: без весов работает DEMO-эвристика; после `train.py` — MobileNetV2, и матрица ошибок модели становится likelihood в Bayes.

---

## Ограничения (честно)

- Пока модель не обучена на TrashNet, используется DEMO-классификатор: он реально анализирует пиксели, но это простая эвристика — на сложных фото он ошибается чаще CNN.
- Два класса: пластик и бумага. Стекло, металл и т. п. не поддерживаются.
- Профиль хранится только в браузере (localStorage), без аккаунтов.
