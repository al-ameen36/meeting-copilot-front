---
title: Vow
emoji: ⚖️
colorFrom: indigo
colorTo: blue
sdk: docker
pinned: false
secrets:
  - VITE_SUPABASE_URL
  - VITE_SUPABASE_ANON_KEY
  - VITE_WHISPER_SERVER_URL
---

# ⚖️ Vow: Real-Time Organizational Memory & Alignment

**Vow** is an autonomous "Agreement Ref" that monitors real-time human discussions to detect, codify, and verify commitments as they happen. Built for high-stakes environments, it bridges the "Alignment Gap" by turning spoken words into structured, machine-readable organizational memory.

---

## 🚀 The Core Innovation: Real-Time Refereeing

Unlike traditional meeting assistants that provide post-hoc summaries, Vow acts as a live participant. It extracts decisions, action items, and financial commitments in near-zero latency, pushing **Confirmation Cards** to participants for instant ratification.

### **Key Technical Pillars**

- **Streaming Inference:** Utilizes a custom [WhisperLive](https://github.com/al-ameen36/WhisperLive) backend for sub-second, WebSocket-driven speech-to-text.
- **Dual-Model Residency:** Both **Llama 3.3 70B** and **Whisper** stay resident on the **AMD MI300X (192GB HBM3)**, eliminating model-swapping latency.
- **Structured Intelligence:** Every vow is codified into a strict JSON schema via vLLM-optimized kernels.
- **Contextual Diarization:** Maintains a stateful memory of speaker identity and evolving consensus.

---

## 🛠️ Technology Stack

- **Hardware:** AMD Instinct™ MI300X (AMD Developer Cloud)
- **Backend:** [WhisperLive](https://github.com/al-ameen36/WhisperLive) (Custom Fork), ROCm 6.x, FastAPI
- **Models:** Meta-Llama-3.3-70B-Instruct, OpenAI-Whisper
- **Frontend:** TanStack Start (Real-time WebSocket UI)

---

## 📦 Installation & Local Setup

To run the Vow inference server and frontend locally or on an AMD instance:

### 1. Clone & Environment Configuration

```bash
git clone [https://github.com/al-ameen36/vow.git](https://github.com/al-ameen36/vow.git)
cd vow/
# Configure your .env. check .env.example for the required variables

pnpm install
pnpm dev
```
