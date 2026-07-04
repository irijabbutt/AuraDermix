# Aura Dermix

A web app that classifies skin conditions from a photo — the browser-based counterpart to my Flutter FYP, **Skin Health Analyzer**.

**Live app:** https://irijabbutt.github.io/AuraDermix/

## Overview

Aura Dermix ports the classification logic from my final year project into a standalone web experience. Upload or capture a photo of a skin concern and get a prediction across common dermatological categories, along with a confidence score and general guidance on next steps.

It's built as a companion to the mobile app — same underlying idea, no install required.

## Background

This project is a web reimplementation of the model and workflow behind **Skin Health Analyzer**, my Flutter-based FYP:

- Backbone: EfficientNetB3, fine-tuned with gradual layer unfreezing
- Trained across 23 DermNet condition classes
- 0.73 weighted F1 on the held-out validation set
- Original mobile pipeline: PyTorch → ONNX → quantized TFLite for on-device inference

Aura Dermix carries that same classification logic into a browser-first interface.

## How it was built

Built through **vibe coding** on Google AI Studio — describing the intended functionality and UI in conversation and iterating from there, rather than hand-writing the app from scratch. It was a fast way to validate the web version of the concept without re-standing-up a full mobile build pipeline.

## Features

- Photo upload / capture for skin condition analysis
- Multi-class prediction with a confidence score
- Plain-language guidance on when to consult a dermatologist
- Lightweight, browser-based — no app install needed

## Disclaimer

Aura Dermix is an informational tool, not a diagnostic device. It does not replace professional medical advice — high-risk or uncertain results should always be followed up with a licensed dermatologist.

## Related work

- [Portfolio](https://irijabbutt.github.io) — more of my AI/ML and Flutter projects

## Author

**Rijab Butt**
AI/ML Developer · BS Artificial Intelligence, UMT
[rijabbutt23@gmail.com](mailto:rijabbutt23@gmail.com) · [LinkedIn](https://linkedin.com/in/rijab-butt-4828b61b0)
