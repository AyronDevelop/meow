const functions = require('firebase-functions')
const { processPdfWithOpenAI } = require('./openai')
const { extractImagesIfAny } = require('./pdfParser')

exports.pdfToSlides = functions.https.onRequest(async (req, res) =>
{
    res.set('Access-Control-Allow-Origin', '*')
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.set('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS')
    {
        return res.status(204).send('')
    }

    if (req.method !== 'POST')
    {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try
    {
        const { pdfBase64, fileName } = req.body || {}
        if (!pdfBase64)
        {
            return res.status(400).json({ error: 'Missing pdfBase64' })
        }
        const images = await extractImagesIfAny(pdfBase64)
        const slides = await processPdfWithOpenAI({ pdfBase64, fileName, images })
        return res.json({ slides })
    } catch (err)
    {
        console.error(err)
        return res.status(500).json({ error: 'Internal error' })
    }
})


