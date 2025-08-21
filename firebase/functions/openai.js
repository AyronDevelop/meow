// Используем глобальный fetch (Node 18 в Firebase Functions)
const functions = require('firebase-functions')

// Преобразует PDF в набор слайдов через OpenAI (gpt-4o-mini)
// Возвращает массив объектов { title, bullets, imageBase64? }
async function processPdfWithOpenAI ({ pdfBase64, fileName, images, apiKeyOverride })
{
    const configKey = (functions.config() && functions.config().openai && functions.config().openai.key) || undefined
    const apiKey = apiKeyOverride || process.env.OPENAI_API_KEY || configKey
    if (!apiKey)
    {
        throw new Error('OPENAI_API_KEY is not set')
    }

    // Пример системной инструкции: дай структуру слайдов. В реале можно добавить извлечение по разделам
    const systemPrompt = `Ты конвертер PDF в презентацию. Верни JSON массив слайдов.
Каждый элемент: { title: string, bullets: string[], optional image hints }`;

    const content = [
        { type: 'text', text: 'Проанализируй PDF и предложи слайды. Ответ только JSON массивом слайдов.' },
        { type: 'text', text: `Имя файла: ${fileName || 'document.pdf'}` }
    ]
    if (images && images[0])
    {
        content.push({
            type: 'image_url',
            image_url: { url: images[0] }
        })
    }

    const body = {
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content }
        ],
        response_format: { type: 'json_object' }
    }

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    })

    if (!resp.ok)
    {
        const text = await resp.text()
        throw new Error(`OpenAI error: ${resp.status} ${text}`)
    }

    const data = await resp.json()
    // Ожидаем, что модель вернет JSON-объект с ключом slides
    let slides
    try
    {
        const content = data.choices?.[0]?.message?.content
        slides = JSON.parse(content).slides || JSON.parse(content)
    } catch (e)
    {
        slides = []
    }

    // Простейшая защита типов
    if (!Array.isArray(slides)) slides = []
    return slides
}

module.exports = { processPdfWithOpenAI }


