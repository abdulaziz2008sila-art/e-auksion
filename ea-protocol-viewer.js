(function () {
  var DEFAULT_PDF = './_E-AUKSION_ __ Bayonnomani tekshirish_files/ELEKTRON.pdf';
  var DEFAULT_WORKER = './_E-AUKSION_ __ Bayonnomani tekshirish_files/pdfjs/pdf.worker.min.js';
  var ANIM_MS = 280;
  var MAX_OUTPUT_SCALE = 3;

  function eaGetScriptEl() {
    return document.querySelector('script[src*="ea-protocol-viewer.js"]');
  }

  function eaGetPdfPath() {
    var script = eaGetScriptEl();
    if (script && script.getAttribute('data-pdf')) return script.getAttribute('data-pdf');
    return DEFAULT_PDF;
  }

  function eaGetWorkerPath() {
    var script = eaGetScriptEl();
    if (script && script.getAttribute('data-pdf-worker')) return script.getAttribute('data-pdf-worker');
    return DEFAULT_WORKER;
  }

  function eaNormalizeUrl(url) {
    try {
      return encodeURI(url).replace(/#/g, '%23');
    } catch (e) {
      return url;
    }
  }

  function eaGetPdfJs() {
    return window.pdfjsLib || window['pdfjs-dist/build/pdf'];
  }

  function eaIsMobile() {
    return window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  }

  function eaGetOutputScale() {
    var dpr = window.devicePixelRatio || 1;
    if (eaIsMobile()) return Math.min(Math.max(dpr, 2), MAX_OUTPUT_SCALE);
    return Math.min(dpr, MAX_OUTPUT_SCALE);
  }

  function eaGetRenderWidth(body) {
    if (body && body.clientWidth > 0) return body.clientWidth;
    var card = body && body.closest('.ea-protocol-dialog__card');
    if (card && card.clientWidth > 0) return card.clientWidth;
    return Math.min(window.innerWidth, 800);
  }

  function eaWaitForDialogReady(body) {
    return new Promise(function (resolve) {
      var deadline = Date.now() + 700;

      function tryMeasure() {
        var width = eaGetRenderWidth(body);
        if (width > 50 && Date.now() >= deadline - 400) {
          requestAnimationFrame(function () {
            resolve(eaGetRenderWidth(body));
          });
          return;
        }
        if (Date.now() > deadline) {
          resolve(width > 0 ? width : Math.min(window.innerWidth, 800));
          return;
        }
        requestAnimationFrame(tryMeasure);
      }

      window.setTimeout(tryMeasure, ANIM_MS + 40);
    });
  }

  function eaLoadPdfXhr(url, pdfjs) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';
      xhr.onload = function () {
        if (xhr.status === 200 || xhr.status === 0) {
          pdfjs.getDocument({ data: xhr.response }).promise.then(resolve).catch(reject);
          return;
        }
        reject(new Error('xhr status ' + xhr.status));
      };
      xhr.onerror = function () { reject(new Error('xhr error')); };
      xhr.send();
    });
  }

  function eaLoadPdfDocument(url, pdfjs) {
    var docUrl = eaNormalizeUrl(url);

    function loadFromData(data) {
      return pdfjs.getDocument({ data: data }).promise;
    }

    function loadFromUrl() {
      return pdfjs.getDocument(docUrl).promise;
    }

    if (typeof fetch === 'function') {
      return fetch(docUrl).then(function (response) {
        if (!response.ok) throw new Error('fetch failed');
        return response.arrayBuffer();
      }).then(loadFromData).catch(function () {
        return eaLoadPdfXhr(docUrl, pdfjs).catch(loadFromUrl);
      });
    }

    return eaLoadPdfXhr(docUrl, pdfjs).catch(loadFromUrl);
  }

  function eaRenderPage(page, pagesWrap, renderWidth) {
    var baseViewport = page.getViewport({ scale: 1 });
    var cssScale = renderWidth / baseViewport.width;
    var outputScale = eaGetOutputScale();
    var viewport = page.getViewport({ scale: cssScale });
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d', { alpha: false });

    canvas.className = 'ea-protocol-pdf-page';
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = '100%';
    canvas.style.height = 'auto';

    pagesWrap.appendChild(canvas);

    var transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
    return page.render({
      canvasContext: ctx,
      viewport: viewport,
      transform: transform
    }).promise;
  }

  function eaRenderPdf(url, container, body, renderWidth) {
    var pdfjs = eaGetPdfJs();
    if (!pdfjs) {
      container.innerHTML = '<p class="ea-protocol-pdf-error">PDF.js yuklanmadi</p>';
      return Promise.reject(new Error('pdfjs missing'));
    }

    pdfjs.GlobalWorkerOptions.workerSrc = eaGetWorkerPath();
    container.innerHTML = '<div class="ea-protocol-pdf-loading">Yuklanmoqda...</div>';

    return eaLoadPdfDocument(url, pdfjs).then(function (pdf) {
      container.innerHTML = '';
      var pagesWrap = document.createElement('div');
      pagesWrap.className = 'ea-protocol-pdf-pages';
      container.appendChild(pagesWrap);

      var width = renderWidth || eaGetRenderWidth(body);
      var tasks = [];
      for (var i = 1; i <= pdf.numPages; i++) {
        (function (pageNum) {
          tasks.push(pdf.getPage(pageNum).then(function (page) {
            return eaRenderPage(page, pagesWrap, width);
          }));
        })(i);
      }
      return Promise.all(tasks);
    }).catch(function () {
      container.innerHTML = '<p class="ea-protocol-pdf-error">PDF yuklanmadi. Sahifani yangilang yoki faylni yuklab oling.</p>';
    });
  }

  function eaOpenProtocolDialog() {
    var dialog = document.getElementById('ea-protocol-dialog');
    var content = document.getElementById('ea-protocol-content');
    var body = dialog && dialog.querySelector('.ea-protocol-dialog__body');
    if (!dialog || !content) return;

    dialog.classList.add('is-open');
    dialog.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        dialog.classList.add('is-visible');
      });
    });

    eaWaitForDialogReady(body).then(function (renderWidth) {
      return eaRenderPdf(eaGetPdfPath(), content, body, renderWidth);
    }).then(function () {
      if (body) body.scrollTop = 0;
    });
  }

  function eaCloseProtocolDialog() {
    var dialog = document.getElementById('ea-protocol-dialog');
    var content = document.getElementById('ea-protocol-content');
    if (!dialog || !dialog.classList.contains('is-open')) return;

    dialog.classList.remove('is-visible');
    window.setTimeout(function () {
      dialog.classList.remove('is-open');
      dialog.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (content) content.innerHTML = '';
    }, ANIM_MS);
  }

  function eaDownloadProtocol(e) {
    if (e) e.preventDefault();
    var url = eaGetPdfPath();
    var link = document.createElement('a');
    link.href = url;
    link.download = 'ELEKTRON.pdf';
    link.target = '_blank';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function eaInitProtocolViewer() {
    var viewBtn = document.getElementById('ea-protocol-view-btn');
    if (viewBtn) viewBtn.addEventListener('click', function (e) {
      e.preventDefault();
      eaOpenProtocolDialog();
    });
    var closeBtn = document.getElementById('ea-protocol-close');
    if (closeBtn) closeBtn.addEventListener('click', eaCloseProtocolDialog);
    var backdrop = document.querySelector('#ea-protocol-dialog .ea-protocol-dialog__backdrop');
    if (backdrop) backdrop.addEventListener('click', eaCloseProtocolDialog);
    var download = document.getElementById('ea-protocol-download');
    if (download) download.addEventListener('click', eaDownloadProtocol);
    document.addEventListener('keydown', function (e) {
      var dialog = document.getElementById('ea-protocol-dialog');
      if (e.key === 'Escape' && dialog && dialog.classList.contains('is-open')) eaCloseProtocolDialog();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', eaInitProtocolViewer);
  } else {
    eaInitProtocolViewer();
  }
})();
