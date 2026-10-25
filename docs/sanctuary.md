# The Sanctuary

The experimental Sanctuary is served at `/sanctuary`. It reuses the shared
Aprameya navigation and does not change the existing hash-based sections.

## Conversation mode

The current experience is an explicitly labeled local guide, not a live AI
assistant. `src/services/firekeeperGuide.ts` matches questions to verified
Aprameya information and returns an honest “not confirmed” response when the
local guide has no answer. No backend, API key, microphone permission, or
external service is required.

To connect a real assistant later, keep provider credentials on a server and
replace the implementation behind `askFirekeeperGuide`. Do not place secret
keys in Vite environment variables or client-side code.

## Firekeeper artwork and optional video

The page uses six transparent poses from the supplied Firekeeper concept sheet
in `public/assets/sanctuary/firekeeper/`. Each state has a WebP image and a PNG
fallback. The display exports were upscaled and gently sharpened from the
original, small pose crops, with soft top and right edges where the source
panels were trimmed. This improves blending at display size but cannot recover
detail or artwork outside the source crops. Use higher-resolution, uncropped
licensed pose images if more genuine detail or framing is needed.

No video is currently included. If a licensed, optimized silent loop is
available, add it under `public/assets/` and replace the portrait image element
with a muted, looping, inline video using the portrait as its `poster`. Keep the
portrait as the fallback for unsupported browsers, reduced-data contexts, and
video load failures. Do not autoplay audio.

## Removing the experiment

Remove the `/sanctuary` path branch and Sanctuary imports from `src/App.tsx`,
remove its entry from `src/components/SiteNavigation.tsx`, and delete
`src/components/sanctuary/`, `src/services/firekeeperGuide.ts`, this document,
and `public/assets/sanctuary/firekeeper/`. The existing site sections remain
independent of these files.
