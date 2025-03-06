export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*', // change this for prod use
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
        };

        // Add CORS headers to allow cross-origin requests
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // only allow POST requests
        if (request.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
        }

        try {
            const payload: AudioPayload = await request.json();

            // We do assume the calling client is passing in audioChunk in the right format:
            // 16-bit PCM, WAV encoding, 16kHz sample rate, mono channel
            if (!payload.audioChunk || !Array.isArray(payload.audioChunk)) {
                return new Response('Invalid payload: Missing or invalid audioChunk or sampleRate', { status: 400, headers: corsHeaders });
            }

            // run the model to get the output transcription from the input audio
            const response = await env.AI.run('@cf/openai/whisper', { audio: payload.audioChunk });

            // Check if 'text' field exists.  The response is NOT json.
            if (response && typeof response === 'object' && 'text' in response) {
                return new Response(JSON.stringify({ transcription: response.text }), {
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                });
            } else {
                // Handle unexpected response format from Whisper
                return new Response(JSON.stringify({ error: 'Unexpected response from AI model', response }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                });
            }
        } catch (error) {
            if (error instanceof Error) {
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                });
            }
            return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }
    },
};

/**
 * Resamples audio from sourceSampleRate to targetSampleRate.  Simplistic nearest-neighbor resampling.
 * This isn't used right now, but could be useful if we want to allow callers
 * to send in audio with different sample rates.
 */
function resample(audio: Float32Array, sourceSampleRate: number, targetSampleRate: number): Float32Array {
    if (sourceSampleRate === targetSampleRate) {
        return audio;
    }

    const ratio = sourceSampleRate / targetSampleRate;
    const newLength = Math.round(audio.length / ratio);
    const resampledAudio = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
        const originalIndex = i * ratio;
        const nearestIndex = Math.round(originalIndex); // Nearest-neighbor
        resampledAudio[i] = audio[Math.min(nearestIndex, audio.length - 1)] || 0;
    }
    return resampledAudio;
}

interface AudioPayload {
    audioChunk?: number[]; // 8-bit unsigned bytes
}

interface Env {
    AI: any; // Cloudflare Workers AI binding
}
