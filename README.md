# Whisper Worker

An example Cloudflare Worker that takes audio and returns a transcription.

Usage:

```
const response = await fetch(workerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioChunk: wavUint8Array }),
});
const { transcription } = await response.json();
```

The trickest part of using this worker is converting the audio to the correct format. The audio that is sent to this worker must fit the following criteria:

1. 16-bit PCM
2. WAV encoding
3. 16kHz sample rate
4. Mono
