import crypto from "node:crypto";

const BASE_URL = process.env.BASE_URL || (process.env.PROJECT_ID ? `https://us-central1-${process.env.PROJECT_ID}.cloudfunctions.net/api` : "");
const ADDON_SECRET = process.env.ADDON_SECRET || "";
if (!BASE_URL || !ADDON_SECRET)
{
    console.error("Missing BASE_URL or ADDON_SECRET env.");
    process.exit(1);
}

function sign (method, path, body)
{
    const ts = Date.now();
    const nonce = crypto.randomUUID();
    const payload = `${method}\n${path}\n${ts}\n${body || ""}\n${nonce}`;
    const sig = crypto.createHmac("sha256", ADDON_SECRET).update(payload).digest("base64");
    return { ts, nonce, sig };
}

function makePdfBuffer ()
{
    const content = `%PDF-1.1\n%\xE2\xE3\xCF\xD3\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Contents 4 0 R>>endobj\n4 0 obj<</Length 44>>stream\nBT /F1 24 Tf 72 120 Td (Hello) Tj ET\nendstream endobj\nxref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000062 00000 n \n0000000117 00000 n \n0000000216 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n300\n%%EOF\n`;
    return Buffer.from(content, "utf8");
}

async function main ()
{
    console.log("BASE_URL=", BASE_URL);

    // public health
    let resp = await fetch(`${BASE_URL}/public/health`);
    console.log("public/health:", resp.status, await resp.text());

    // get signed url
    const pdf = makePdfBuffer();
    const fileSha = crypto.createHash("sha256").update(pdf).digest("hex");
    const signedBody = {
        fileName: "demo.pdf",
        contentType: "application/pdf",
        contentLength: pdf.byteLength,
        contentSha256: fileSha,
    };
    const signedBodyStr = JSON.stringify(signedBody);
    {
        const path = "/v1/uploads/signed-url";
        const { ts, nonce, sig } = sign("POST", path, signedBodyStr);
        resp = await fetch(`${BASE_URL}${path}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Timestamp": String(ts),
                "X-Nonce": nonce,
                "X-Signature": sig,
            },
            body: signedBodyStr,
        });
    }
    const signedText = await resp.text();
    let signed;
    try { signed = JSON.parse(signedText); } catch { signed = { raw: signedText }; }
    console.log("signed-url:", resp.status, signed);
    if (!resp.ok) process.exit(2);

    // upload PDF via signed URL
    const putResp = await fetch(signed.uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Type": "application/pdf",
            "x-goog-content-sha256": "UNSIGNED-PAYLOAD",
        },
        body: pdf,
    });
    console.log("upload PUT:", putResp.status, putResp.statusText);
    if (!putResp.ok) process.exit(3);

    // create job
    const jobBody = { uploadId: signed.uploadId, pdfName: "demo.pdf", options: { theme: "DEFAULT" } };
    const jobBodyStr = JSON.stringify(jobBody);
    let jobId;
    {
        const path = "/v1/jobs";
        const { ts, nonce, sig } = sign("POST", path, jobBodyStr);
        resp = await fetch(`${BASE_URL}${path}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Timestamp": String(ts),
                "X-Nonce": nonce,
                "X-Signature": sig,
            },
            body: jobBodyStr,
        });
    }
    const jobText = await resp.text();
    let job;
    try { job = JSON.parse(jobText); } catch { job = { raw: jobText }; }
    console.log("jobs create:", resp.status, job);
    if (!resp.ok) process.exit(4);
    jobId = job.jobId;

    // poll status
    for (let i = 0; i < 15; i++)
    {
        const path = `/v1/jobs/${jobId}`;
        const { ts, nonce, sig } = sign("GET", path, "");
        const s = await fetch(`${BASE_URL}${path}`, {
            method: "GET",
            headers: { "X-Timestamp": String(ts), "X-Nonce": nonce, "X-Signature": sig },
        });
        const dataText = await s.text();
        let data;
        try { data = JSON.parse(dataText); } catch { data = { raw: dataText }; }
        console.log(`status[${i}]:`, s.status, data.status || data.raw);
        if (data.status === "done" || data.status === "error" || data.status === "cancelled")
        {
            console.log("final:", data);
            if (data.status === "done")
            {
                try
                {
                    const r = await fetch(data.result.resultJsonUrl);
                    const txt = await r.text();
                    let js; try { js = JSON.parse(txt); } catch { js = {}; }
                    const imagesCount = Array.isArray(js.slides) ? js.slides.reduce((n, sl) => n + (Array.isArray(sl.images) ? sl.images.length : 0), 0) : 0;
                    console.log("images_in_result:", imagesCount);
                } catch { }
            }
            process.exit(0);
        }
        await new Promise((r) => setTimeout(r, 4000));
    }
    console.log("timeout waiting for job to complete");
    process.exit(5);
}

main().catch((e) =>
{
    console.error(e);
    process.exit(1);
});


