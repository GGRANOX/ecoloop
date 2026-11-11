"""Train the plastic-vs-paper classifier (MobileNetV2, transfer learning).

Expected data layout (TrashNet "dataset-resized" works as is; other classes are ignored):
    data/trashnet/plastic/*.jpg
    data/trashnet/paper/*.jpg

Usage:
    python -m backend.ml.train --data data/trashnet --epochs 8

Outputs (picked up automatically by the API, which switches to "mode": "model"):
    backend/ml/model/ecoloop_mobilenetv2.pt   - weights (state_dict)
    backend/ml/model/meta.json                - classes, accuracy, confusion matrix
"""
from __future__ import annotations

import argparse
import json
import random
import time
from pathlib import Path

import torch
from PIL import Image
from torch import nn
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms

CLASSES = ["paper", "plastic"]  # index 0 = paper, 1 = plastic
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
MEAN, STD = [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]


class FileDataset(Dataset):
    def __init__(self, items, transform):
        self.items, self.transform = items, transform

    def __len__(self):
        return len(self.items)

    def __getitem__(self, i):
        path, label = self.items[i]
        return self.transform(Image.open(path).convert("RGB")), label


def collect(data_dir: Path):
    items = []
    for label, cls in enumerate(CLASSES):
        folder = data_dir / cls
        if not folder.is_dir():
            raise SystemExit(f"Missing folder {folder}. See README -> 'Training the model'.")
        items += [(p, label) for p in sorted(folder.iterdir()) if p.suffix.lower() in EXTS]
    return items


def stratified_split(items, val_frac, seed):
    rng = random.Random(seed)
    train, val = [], []
    for label in range(len(CLASSES)):
        group = [it for it in items if it[1] == label]
        rng.shuffle(group)
        n_val = max(1, int(len(group) * val_frac))
        val += group[:n_val]
        train += group[n_val:]
    return train, val


def build_model(pretrained: bool) -> nn.Module:
    weights = models.MobileNet_V2_Weights.IMAGENET1K_V1 if pretrained else None
    model = models.mobilenet_v2(weights=weights)
    # freeze early feature blocks, fine-tune the last ones + new head
    for p in model.features[:-4].parameters():
        p.requires_grad = False
    model.classifier[1] = nn.Linear(model.last_channel, len(CLASSES))
    return model


def evaluate(model, loader):
    model.eval()
    cm = [[0] * len(CLASSES) for _ in CLASSES]
    with torch.no_grad():
        for x, y in loader:
            pred = model(x).argmax(1)
            for t, p in zip(y.tolist(), pred.tolist()):
                cm[t][p] += 1
    correct = sum(cm[i][i] for i in range(len(CLASSES)))
    total = sum(map(sum, cm))
    return correct / max(total, 1), cm


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default="data/trashnet")
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent / "model"))
    ap.add_argument("--epochs", type=int, default=8)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--val", type=float, default=0.2)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--no-pretrained", action="store_true", help="skip ImageNet weights (offline smoke test)")
    args = ap.parse_args()

    torch.manual_seed(args.seed)
    items = collect(Path(args.data))
    train_items, val_items = stratified_split(items, args.val, args.seed)
    print(f"Images: {len(items)}  train={len(train_items)}  val={len(val_items)}")

    train_tf = transforms.Compose([
        transforms.RandomResizedCrop(224, scale=(0.6, 1.0)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15),
        transforms.ColorJitter(0.3, 0.3, 0.3, 0.05),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ])
    val_tf = transforms.Compose([
        transforms.Resize(256), transforms.CenterCrop(224), transforms.ToTensor(), transforms.Normalize(MEAN, STD),
    ])
    train_loader = DataLoader(FileDataset(train_items, train_tf), batch_size=args.batch, shuffle=True)
    val_loader = DataLoader(FileDataset(val_items, val_tf), batch_size=args.batch)

    model = build_model(pretrained=not args.no_pretrained)
    optim = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=args.lr)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(optim, T_max=max(args.epochs, 1))
    loss_fn = nn.CrossEntropyLoss()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    best_acc, best_cm = -1.0, None
    for epoch in range(1, args.epochs + 1):
        model.train()
        t0, running, n = time.time(), 0.0, 0
        for x, y in train_loader:
            optim.zero_grad()
            loss = loss_fn(model(x), y)
            loss.backward()
            optim.step()
            running += loss.item() * len(y)
            n += len(y)
        sched.step()
        acc, cm = evaluate(model, val_loader)
        print(f"epoch {epoch}/{args.epochs}  loss={running / max(n, 1):.4f}  val_acc={acc:.4f}  ({time.time() - t0:.0f}s)")
        if acc > best_acc:
            best_acc, best_cm = acc, cm
            torch.save(model.state_dict(), out / "ecoloop_mobilenetv2.pt")

    print("\nConfusion matrix (rows = true, cols = predicted):")
    print(f"{'':>10}" + "".join(f"{c:>10}" for c in CLASSES))
    for i, c in enumerate(CLASSES):
        print(f"{c:>10}" + "".join(f"{v:>10}" for v in best_cm[i]))
    print(f"Best validation accuracy: {best_acc:.4f}")

    # row-normalised confusion -> P(model says k | true class c), used by the Bayes step.
    # Laplace (+1) smoothing keeps every likelihood > 0 even on a tiny validation set.
    confusion = {}
    for i, c in enumerate(CLASSES):
        row = sum(best_cm[i]) + len(CLASSES)
        confusion[c] = {k: (best_cm[i][j] + 1) / row for j, k in enumerate(CLASSES)}
    counts = {c: sum(1 for _, l in train_items if l == i) for i, c in enumerate(CLASSES)}
    meta = {
        "classes": CLASSES,
        "val_accuracy": best_acc,
        "confusion_matrix": best_cm,
        "confusion": confusion,
        "train_counts": counts,
        "epochs": args.epochs,
        "pretrained": not args.no_pretrained,
    }
    (out / "meta.json").write_text(json.dumps(meta, indent=2))
    print(f"Saved weights and meta.json to {out}")


if __name__ == "__main__":
    main()
