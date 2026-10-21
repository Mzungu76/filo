"""Genera i due suoni di Filo (richiede numpy):
  focus: inizio attività  -> campanelli brillanti che salgono
  break: inizio pausa     -> toni caldi e morbidi che scendono, chiusi da un accordo
Uso: python3 scripts/make-sounds.py
"""
import wave
import numpy as np

SR = 44100
OUT = ["public/sounds", "android/app/src/main/res/raw"]


def tone(freq, dur, partials, attack, decay):
    t = np.arange(int(SR * dur)) / SR
    sig = sum(a * np.sin(2 * np.pi * freq * m * t) for m, a in partials)
    env = np.minimum(1, t / attack) * np.exp(-t / decay)
    return sig * env


def place(track, sig, start):
    i = int(SR * start)
    track[i:i + len(sig)] += sig[: len(track) - i]


def save(name, track):
    track = track / np.max(np.abs(track)) * 0.85
    pcm = (track * 32767).astype("<i2")
    for folder in OUT:
        with wave.open(f"{folder}/{name}.wav", "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())


bell = [(1, 1.0), (2, 0.35), (3.01, 0.25), (4.2, 0.12)]
warm = [(1, 1.0), (2, 0.22), (0.5, 0.3)]

# Inizio attività: do-mi-sol-DO, brillante e ascendente
focus = np.zeros(int(SR * 2.4))
for f, start, dur, dec in [(523.25, 0.00, 1.0, 0.25), (659.25, 0.15, 1.0, 0.25), (783.99, 0.30, 1.0, 0.25), (1046.5, 0.48, 1.8, 0.55)]:
    place(focus, tone(f, dur, bell, 0.004, dec), start)

# Inizio pausa: mi-do-sol scendono piano, poi accordo di do che si dissolve
brk = np.zeros(int(SR * 3.4))
for f, start, dur, dec in [(659.25, 0.00, 1.2, 0.35), (523.25, 0.50, 1.2, 0.35), (392.00, 1.00, 1.4, 0.4)]:
    place(brk, tone(f, dur, warm, 0.03, dec), start)
for f in (261.63, 329.63, 392.00):
    place(brk, 0.7 * tone(f, 1.9, warm, 0.06, 0.7), 1.55)

save("sound_focus", focus)
save("sound_break", brk)
