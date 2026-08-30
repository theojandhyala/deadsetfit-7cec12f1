# Breakup muscle-map carousel — draft

Status: review only. Do not publish until the owner approves both rendered slides.

## Reference mechanism

Two-slide native TikTok curiosity loop:

1. Ordinary real-person image with a short emotional question.
2. Product-native muscle-map payoff that answers the question visually.

The structure is informed by Stronger's `stronger_sadie` two-slide muscle-progression post. The wording, source image, branding, and UI treatment here are original to DEADSET.

## Slides

1. A real, licensed dark-gym physique pose matching the supplied Pinterest composition: `how much did the breakup hurt?`
2. DEADSET's exact detailed front/back muscle-map component from the current Xcode build: `this much.`

The second slide no longer uses the older simplified diagram or a fabricated progress screen. The anatomy paths, strokes, mirroring, and muscle colours are rendered directly by the `MuscleDiagram` module shipped inside the installed Xcode build. The surrounding 1080×1920 frame is marketing layout; the anatomy itself is the exact app component.

## Draft caption

apparently heartbreak has a training split. see what you actually train with deadset on appstore

#gymtok #gymprogress #workouttracker #deadset

## Source notes

- Human image: real Pexels photo by foad shariyati, downloaded from `pexels.com/photo/muscular-man-posing-in-a-modern-gym-mirror-29591136/` under the Pexels license. No generated person.
- Muscle artwork: exact compiled `MuscleDiagram` module from the currently installed `org.deadsetfit.app` Xcode/simulator build.
- Xcode capture source: `xcode-muscle-preview.html`; it imports the shipped module rather than redrawing the anatomy.
- No AI-generated image or fabricated testimonial.
