export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
        };
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        if (request.method === 'GET') {
            const res = await fetch(
                'https://github.com/Azure-Samples/cognitive-services-speech-sdk/raw/master/samples/cpp/windows/console/samples/enrollment_audio_katie.wav'
            );
            const blob = await res.arrayBuffer();
            const uint8Audio = new Uint8Array(blob);
            const byteArray = [...uint8Audio]; // Convert to regular array
            console.log('WAV File Byte Array (First 100 bytes):', JSON.stringify(byteArray.slice(0, 100))); // Log a portion
            const response = await env.AI.run('@cf/openai/whisper', { audio: byteArray });
            return Response.json({ input: { audio: [] }, response });
        }

        if (request.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
        }

        try {
            const payload: AudioPayload = await request.json();

            if (!payload.audioChunk || !Array.isArray(payload.audioChunk) || !payload.sampleRate) {
                return new Response('Invalid payload: Missing or invalid audioChunk or sampleRate', { status: 400, headers: corsHeaders });
            }

            // // 1. Convert number[] to Float32Array (reconstruct client-side format)
            // const float32Audio = new Float32Array(payload.audioChunk);

            // logSummary('float32Audio:', float32Audio);

            // // 2. Resample if necessary
            // const resampledAudio = payload.sampleRate !== 16000 ? resample(float32Audio, payload.sampleRate, 16000) : float32Audio;

            // logSummary('resampledAudio:', resampledAudio);

            // // 3. Convert Float32Array to Int16Array (PCM 16-bit)
            // const int16Audio = float32ToInt16(resampledAudio);

            // logSummary('int16Audio:', int16Audio);

            // 4. Convert to Uint8Array (Whisper model requirement)
            // const uint8Audio = int16ToUnsignedBytes(int16Audio);

            // logSummary('uint8Audio:', uint8Audio);

            // 5. Run Whisper model
            const response = await env.AI.run('@cf/openai/whisper', { audio: payload.audioChunk });
            // const response = await env.AI.run('@cf/openai/whisper', { audio: uint8Audio });
            // const response = await env.AI.run('@cf/openai/whisper', { audio: payload.spectrogram });

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

function logSummary(name: string, arr: Float32Array | Int16Array | Uint8Array | number[]) {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let nanCount = 0;

    for (let i = 0; i < arr.length; i++) {
        const val = arr[i] || 0;
        if (Number.isNaN(val)) {
            nanCount++;
        } else {
            min = Math.min(min, val);
            max = Math.max(max, val);
            sum += val;
        }
    }

    const mean = arr.length > 0 ? sum / arr.length : NaN;

    console.log(`${name} Summary:
        Min: ${min}
        Max: ${max}
        Mean: ${mean}
        NaN Count: ${nanCount}
        Length: ${arr.length}
        First 10 values: ${JSON.stringify(Array.from(arr).slice(0, 10))}`);
}

/**
 * Resamples audio from sourceSampleRate to targetSampleRate.  Simplistic nearest-neighbor resampling.
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

/**
 * Converts a Float32Array (assumed to be in the range -1.0 to +1.0) to an Int16Array.
 * This function performs clamping to avoid overflow.
 */
function float32ToInt16(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        const sample = float32Array[i] || 0;
        // Clamp the sample to the range -1.0 to +1.0, then scale and convert to int16.
        const scaledSample = Math.max(-1, Math.min(1, sample)) * 32767;
        int16Array[i] = Math.round(scaledSample); // Round to nearest integer
    }
    return int16Array;
}

/**
 * Converts an Int16Array to unsighed 8-bit bytes (Uint8Array).
 */
function int16ToUnsignedBytes(int16Array: Int16Array): number[] {
    const bytes: number[] = [];
    const dataView = new DataView(int16Array.buffer); // Use a DataView for byte-level access

    for (let i = 0; i < int16Array.length; i++) {
        // Get the 16-bit value (little-endian)
        const int16Value = dataView.getInt16(i * 2, true); // true for little-endian

        // Extract the low byte (bits 0-7)
        const lowByte = int16Value & 0xff;

        // Extract the high byte (bits 8-15)
        const highByte = (int16Value >> 8) & 0xff;

        bytes.push(lowByte);
        bytes.push(highByte);
    }
    return bytes;
}

interface AudioPayload {
    sampleRate: number;
    audioChunk?: number[]; // Regular array of numbers
    spectrogram?: number[];
}

interface Env {
    AI: any; // Cloudflare Workers AI binding
}
