export default {
    async fetch(
        request: Request,
        env: Env,
        ctx: ExecutionContext
    ): Promise<Response> {
        if (request.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405 });
        }

        try {
            const audioBlob = await request.blob();
            const audioBuffer = await audioBlob.arrayBuffer();
            const audioArray = new Float32Array(audioBuffer);

            const inputs = {
                audio: audioArray,
            };

            const response = await env.AI.run('@cf/openai/whisper', inputs);

            if (!response.text) {
                return new Response(
                    JSON.stringify({ error: 'No transcription text received' }),
                    {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' },
                    }
                );
            }

            return new Response(
                JSON.stringify({ transcription: response.text }),
                {
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        } catch (error) {
            console.error('Error processing audio:', error);
            return new Response(JSON.stringify({ error: error + '' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    },
};

interface Env {
    AI: any; // Cloudflare Workers AI binding
}
