const MODEL = 'gemini-3-pro-image';
const MAX_INPUT_BYTES = 12 * 1024 * 1024;

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').send(JSON.stringify(body));
}

function allowedImageUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return false;
    const configured = process.env.SUPABASE_URL;
    if (!configured) return true;
    const host = new URL(configured).hostname;
    return u.hostname === host || u.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!process.env.GEMINI_API_KEY) return json(res, 500, { error: 'GEMINI_API_KEY is not configured on Vercel.' });

  try {
    const { imageUrl, aspectRatio = '1:1', imageSize = '2K' } = req.body || {};
    if (!imageUrl || !allowedImageUrl(imageUrl)) {
      return json(res, 400, { error: 'A valid HTTPS Supabase image URL is required.' });
    }

    const source = await fetch(imageUrl, { redirect: 'follow' });
    if (!source.ok) throw new Error(`Source image returned HTTP ${source.status}.`);
    const contentLength = Number(source.headers.get('content-length') || 0);
    if (contentLength > MAX_INPUT_BYTES) throw new Error('Source image is larger than 12 MB.');

    const mimeType = (source.headers.get('content-type') || 'image/jpeg').split(';')[0].toLowerCase();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      throw new Error(`Unsupported source image type: ${mimeType}`);
    }

    const bytes = Buffer.from(await source.arrayBuffer());
    if (bytes.length > MAX_INPUT_BYTES) throw new Error('Source image is larger than 12 MB.');

    const prompt = `Restore and professionally photograph the EXACT PRODUCT shown in the reference image for a premium commercial product catalogue.

CRITICAL PRODUCT FIDELITY RULES:
- Keep the exact product identity, geometry, proportions, construction, materials, colours, patterns, labels, markings, controls, buttons, handles, openings and every visible physical detail.
- Do NOT redesign, beautify, modernize, simplify or invent any part of the product.
- Do NOT add accessories, props, people, text, logos, badges, watermarks or branding that are not already physically present on the product.
- If the source is blurry, recover plausible fine detail only from what is actually visible; never invent hidden details.
- Keep the product at the same orientation and overall composition unless a tiny correction is needed to present it cleanly.
- Remove distracting background clutter and replace it with a seamless clean white studio background.
- Use realistic professional studio lighting, balanced exposure, accurate neutral white balance and a subtle natural contact shadow.
- Make the product crisp and catalogue-ready while preserving realistic texture and edges.
- No dramatic effects, no reflections that obscure details, no artificial glow.
- Output ONLY the finished product photograph, with no surrounding text or graphic design.
This is an image-to-image restoration/edit, not a new product design.`;

    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: bytes.toString('base64') } }
        ]
      }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        responseFormat: {
          image: {
            aspectRatio,
            imageSize
          }
        }
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();
    if (!response.ok) {
      const message = data?.error?.message || `Gemini API returned HTTP ${response.status}.`;
      return json(res, response.status, { error: message });
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(part => part.inlineData?.data);
    if (!imagePart) {
      const text = parts.find(part => part.text)?.text;
      throw new Error(text || 'Gemini did not return an image.');
    }

    const outputMime = imagePart.inlineData.mimeType || 'image/png';
    const output = Buffer.from(imagePart.inlineData.data, 'base64');
    res.status(200)
      .setHeader('Content-Type', outputMime)
      .setHeader('Cache-Control', 'no-store')
      .send(output);
  } catch (error) {
    return json(res, 500, { error: error?.message || 'Image enhancement failed.' });
  }
}
