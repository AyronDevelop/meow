function onOpen (e)
{
    SlidesApp.getUi()
        .createMenu('PDF to Slides')
        .addItem('Open sidebar', 'showSidebar')
        .addToUi();
}

function onInstall (e)
{
    onOpen(e);
}

function showSidebar ()
{
    var html = HtmlService.createHtmlOutputFromFile('Sidebar')
        .setTitle('PDF to Slides');
    SlidesApp.getUi().showSidebar(html);
}

function getConfig_ ()
{
    var props = PropertiesService.getScriptProperties();
    return {
        baseUrl: props.getProperty('BASE_URL') || '',
        sharedSecret: props.getProperty('ADDON_SHARED_SECRET') || '',
    };
}

function signHmac_ (method, path, body)
{
    var cfg = getConfig_();
    if (!cfg.baseUrl || !cfg.sharedSecret)
    {
        throw new Error('Missing BASE_URL or ADDON_SHARED_SECRET in Script Properties');
    }
    var ts = Date.now();
    var nonce = Utilities.getUuid();
    var payload = [method, path, String(ts), body || '', nonce].join('\n');
    var sigBytes = Utilities.computeHmacSha256Signature(payload, cfg.sharedSecret);
    var b64 = Utilities.base64Encode(sigBytes);
    return { ts: ts, nonce: nonce, signature: b64 };
}

function callBackend_ (method, path, bodyObj)
{
    var cfg = getConfig_();
    var url = cfg.baseUrl + path;
    var bodyStr = (method === 'GET' || method === 'HEAD') ? '' : JSON.stringify(bodyObj || {});
    var sig = signHmac_(method, path, bodyStr);
    var params = {
        method: method,
        contentType: 'application/json',
        muteHttpExceptions: true,
        headers: {
            'X-Timestamp': String(sig.ts),
            'X-Nonce': sig.nonce,
            'X-Signature': sig.signature,
        }
    };
    if (bodyStr)
    {
        params.payload = bodyStr;
    }
    var resp = UrlFetchApp.fetch(url, params);
    var code = resp.getResponseCode();
    var text = resp.getContentText();
    if (code >= 200 && code < 300)
    {
        try { return JSON.parse(text); } catch (e) { return text; }
    }
    throw new Error('Backend error ' + code + ': ' + text);
}

function apiCreateSignedUrl (req)
{
    var body = {
        fileName: req && req.fileName || 'upload.pdf',
        contentType: 'application/pdf',
        contentLength: req && req.contentLength || 0,
        contentSha256: req && req.contentSha256 || '',
    };
    return callBackend_('POST', '/v1/uploads/signed-url', body);
}

function apiCreateJob (uploadId, options)
{
    var body = { uploadId: uploadId, pdfName: 'upload.pdf', options: {} };
    return callBackend_('POST', '/v1/jobs', body);
}

function apiGetJob (jobId)
{
    return callBackend_('GET', '/v1/jobs/' + encodeURIComponent(jobId), '');
}

function fetchResultJson (resultUrl)
{
    var resp = UrlFetchApp.fetch(resultUrl, { muteHttpExceptions: true });
    if (resp.getResponseCode() >= 200 && resp.getResponseCode() < 300)
    {
        var txt = resp.getContentText();
        return JSON.parse(txt);
    }
    throw new Error('Failed to fetch result.json');
}

function applySlidesVerbose (slidesResult)
{
    if (!slidesResult || !slidesResult.slides || !slidesResult.slides.length)
    {
        throw new Error('Invalid SlidesResult');
    }
    var events = [];
    var pres = SlidesApp.getActivePresentation();

    var pageWidth = pres.getPageWidth();
    var pageHeight = pres.getPageHeight();

    var layoutsConst = {
        'TITLE_AND_BODY': SlidesApp.PredefinedLayout.TITLE_AND_BODY,
    };

    for (var i = 0; i < slidesResult.slides.length; i++)
    {
        var s = slidesResult.slides[i];

        var hasRightImage = s.images && s.images.length > 0 &&
            s.images.some(function (img) { return img.placement === 'RIGHT'; });
        var hasBackgroundImage = false;
        var layoutKey = 'BLANK';

        var slide = layoutKey === 'BLANK' ?
            pres.appendSlide(SlidesApp.PredefinedLayout.BLANK) :
            pres.appendSlide(layoutsConst[layoutKey] || SlidesApp.PredefinedLayout.TITLE_AND_BODY);
        events.push('appendSlide:' + layoutKey + (hasRightImage ? '.hasRight' : '') + (hasBackgroundImage ? '.hasBG' : ''));

        try 
        {
            var elementsToRemove = [];
            var elements = slide.getPageElements();
            for (var ei = 0; ei < elements.length; ei++)
            {
                var el = elements[ei];
                if (el.getPageElementType && el.getPageElementType() === SlidesApp.PageElementType.SHAPE)
                {
                    var sh = el.asShape();
                    var ph = sh.getPlaceholder();
                    if (ph)
                    {
                        var placeholderType = ph.getType();
                        var isTextPlaceholder = (
                            placeholderType === SlidesApp.PlaceholderType.TITLE ||
                            placeholderType === SlidesApp.PlaceholderType.SUBTITLE ||
                            placeholderType === SlidesApp.PlaceholderType.BODY ||
                            placeholderType === SlidesApp.PlaceholderType.CENTERED_TITLE
                        );

                        if (isTextPlaceholder && (hasRightImage || hasBackgroundImage))
                        {
                            try 
                            {
                                var text = sh.getText();
                                if (!text || text.asString().trim() === '' ||
                                    text.asString().indexOf('Click to add') === 0 ||
                                    text.asString().indexOf('Введите заголовок') === 0 ||
                                    text.asString().indexOf('Введите текст') === 0)
                                {
                                    elementsToRemove.push(el);
                                }
                            } catch (textErr) 
                            {
                                elementsToRemove.push(el);
                            }
                        }
                    }
                }
            }
            for (var ri = 0; ri < elementsToRemove.length; ri++)
            {
                elementsToRemove[ri].remove();
            }
            if (elementsToRemove.length > 0)
            {
                events.push('removed_text_placeholders:' + elementsToRemove.length);
            }
        } catch (cleanupErr) 
        {
            events.push('cleanup_error:' + (cleanupErr && cleanupErr.message ? cleanupErr.message : cleanupErr));
        }

        if (layoutKey === 'BLANK' && hasRightImage)
        {
            var margin = pageWidth * 0.04;
            var gap = pageWidth * 0.02;
            var rightMargin = 0;
            var textAreaWidth = pageWidth * 0.46;
            var imageAreaWidth = Math.max(pageWidth - rightMargin - (margin + textAreaWidth + gap), pageWidth * 0.3);

            if (s.title)
            {
                try
                {
                    var titleBox = slide.insertTextBox(s.title, margin, pageHeight * 0.08, textAreaWidth, pageHeight * 0.12);
                    titleBox.getText().getTextStyle().setFontSize(24).setBold(true);
                    if (i === 0) { titleBox.getText().getTextStyle().setForegroundColor('#000000'); }
                    events.push('title.custom');
                } catch (e1) { events.push('title.error:' + (e1 && e1.message ? e1.message : e1)); }
            }

            if (s.bullets && s.bullets.length)
            {
                try
                {
                    var bulletText = '';
                    for (var b = 0; b < s.bullets.length; b++)
                    {
                        bulletText += '• ' + String(s.bullets[b]) + '\n';
                    }
                    var bodyBox = slide.insertTextBox(bulletText, margin, pageHeight * 0.25, textAreaWidth, pageHeight * 0.65);
                    bodyBox.getText().getTextStyle().setFontSize(14);
                    if (i === 0) { bodyBox.getText().getTextStyle().setForegroundColor('#000000'); }
                    events.push('bullets.custom:' + s.bullets.length);
                } catch (e2) { events.push('bullets.error:' + (e2 && e2.message ? e2.message : e2)); }
            }

            for (var j = 0; j < s.images.length; j++)
            {
                var im = s.images[j];
                if (im.placement === 'RIGHT')
                {
                    try
                    {
                        var respImg = UrlFetchApp.fetch(im.url, { muteHttpExceptions: true });
                        var codeImg = respImg.getResponseCode();
                        events.push('image.fetch:' + codeImg);
                        if (codeImg >= 200 && codeImg < 300)
                        {
                            var blob = respImg.getBlob();
                            var rightImg = slide.insertImage(blob);

                            var imgWidth = rightImg.getWidth();
                            var imgHeight = rightImg.getHeight();
                            var aspectRatio = imgWidth / imgHeight;

                            var containerWidth = imageAreaWidth;
                            var containerHeight = pageHeight;
                            var containerAspectRatio = containerWidth / containerHeight;

                            var newWidth, newHeight;

                            if (aspectRatio > containerAspectRatio)
                            {
                                newWidth = containerWidth;
                                newHeight = newWidth / aspectRatio;
                            }
                            else
                            {
                                newHeight = containerHeight;
                                newWidth = newHeight * aspectRatio;
                                if (newWidth > containerWidth) { newWidth = containerWidth; newHeight = newWidth / aspectRatio; }
                            }

                            var imageLeft = pageWidth - rightMargin - newWidth;
                            var imageTop = 0;

                            rightImg.setLeft(imageLeft).setTop(imageTop).setWidth(newWidth).setHeight(newHeight);

                            events.push('image.right.centered');
                        }
                    } catch (e4) { events.push('image.error:' + (e4 && e4.message ? e4.message : e4)); }
                }
            }
        }
        else
        {
            var titleShape = null, bodyShape = null;
            try
            {
                var elements = slide.getPageElements();
                for (var ei = 0; ei < elements.length; ei++)
                {
                    var el = elements[ei];
                    if (el.getPageElementType && el.getPageElementType() === SlidesApp.PageElementType.SHAPE)
                    {
                        var sh = el.asShape();
                        var ph = sh.getPlaceholder();
                        if (ph)
                        {
                            var t = ph.getType();
                            if (!titleShape && t === SlidesApp.PlaceholderType.TITLE) titleShape = sh;
                            if (!bodyShape && t === SlidesApp.PlaceholderType.BODY) bodyShape = sh;
                        }
                    }
                }
            } catch (e0) { }

            try
            {
                if (s.title && titleShape)
                {
                    titleShape.getText().setText(s.title);
                    events.push('title.placeholder');
                }
                else if (s.title)
                {
                    slide.insertTextBox(s.title || '', pageWidth * 0.05, pageHeight * 0.1, pageWidth * 0.9, pageHeight * 0.15);
                    events.push('title.textbox');
                }
            } catch (e1) { events.push('title.error:' + (e1 && e1.message ? e1.message : e1)); }

            if (s.bullets && s.bullets.length)
            {
                try
                {
                    var textShape = bodyShape || slide.insertTextBox('', pageWidth * 0.05, pageHeight * 0.3, pageWidth * 0.9, pageHeight * 0.6);
                    var txt = textShape.getText();
                    txt.clear();
                    for (var b = 0; b < s.bullets.length; b++)
                    {
                        txt.appendParagraph(String(s.bullets[b]));
                    }
                    txt.getListStyle().applyListPreset(SlidesApp.ListPreset.BULLET_ARROW_DIAMOND_DISC);
                    events.push((bodyShape ? 'bullets.placeholder:' : 'bullets.textbox:') + s.bullets.length);
                } catch (e2) { events.push('bullets.error:' + (e2 && e2.message ? e2.message : e2)); }
            }

            if (s.images && s.images.length)
            {
                for (var j = 0; j < s.images.length; j++)
                {
                    var im = s.images[j];
                    if (im.placement !== 'RIGHT')
                    {
                        try
                        {
                            var respImg = UrlFetchApp.fetch(im.url, { muteHttpExceptions: true });
                            var codeImg = respImg.getResponseCode();
                            events.push('image.fetch:' + codeImg);
                            if (codeImg >= 200 && codeImg < 300)
                            {
                                var blob = respImg.getBlob();
                                var placement = im.placement || 'FULL_WIDTH';
                                if (placement === 'BACKGROUND')
                                {
                                    try
                                    {
                                        slide.getBackground().setPictureFill(blob);
                                        events.push('image.background');
                                    } catch (bgErr)
                                    {
                                        var bgImg = slide.insertImage(blob);
                                        bgImg.setLeft(0).setTop(0).setWidth(pageWidth).setHeight(pageHeight);
                                        bgImg.sendToBack();
                                        events.push('image.background.fallback');
                                    }
                                } else if (placement === 'LEFT')
                                {
                                    var leftImg = slide.insertImage(blob);
                                    leftImg.setLeft(pageWidth * 0.05).setTop(pageHeight * 0.3).setWidth(pageWidth * 0.4);
                                    events.push('image.left');
                                } else
                                {
                                    var fw = slide.insertImage(blob);
                                    fw.setLeft(pageWidth * 0.05).setTop(pageHeight * 0.3).setWidth(pageWidth * 0.9);
                                    events.push('image.fullwidth');
                                }
                            }
                        } catch (e4) { events.push('image.error:' + (e4 && e4.message ? e4.message : e4)); }
                    }
                }
            }
        }

        if (s.notes)
        {
            try
            {
                var notesShape = slide.getNotesPage().getSpeakerNotesShape();
                if (notesShape) notesShape.getText().setText(s.notes);
            } catch (e3) { }
        }
    }
    return { ok: true, inserted: slidesResult.slides.length, events: events };
}

function applySlides (slidesResult)
{
    return applySlidesVerbose(slidesResult);
}


