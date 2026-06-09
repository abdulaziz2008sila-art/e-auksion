(function () {
  var DEFAULT_PDF = './_E-AUKSION_ __ Bayonnomani tekshirish_files/ELEKTRON.pdf';
  var ANIM_MS = 280;

  function eaGetPdfPath() {
    var script = document.querySelector('script[src*="ea-protocol-viewer.js"]');
    if (script && script.getAttribute('data-pdf')) return script.getAttribute('data-pdf');
    return DEFAULT_PDF;
  }

  function eaGetPdfJs() {
    return window.pdfjsLib || window['pdfjs-dist/build/pdf'];
  }

  function eaRenderPdf(url, container) {
    var pdfjs = eaGetPdfJs();
    if (!pdfjs) {
      container.innerHTML = '<p class="ea-protocol-pdf-error">PDF.js yuklanmadi</p>';
      return Promise.reject(new Error('pdfjs missing'));
    }
    pdfjs.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    container.innerHTML = '<div class="ea-protocol-pdf-loading">Yuklanmoqda...</div>';

    function eaLoadPdfDocument() {
      function loadByUrl() {
        return pdfjs.getDocument(url).promise;
      }
      return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = function () {
          if (xhr.status === 200 || xhr.status === 0) {
            pdfjs.getDocument({ data: xhr.response }).promise.then(resolve).catch(function () {
              loadByUrl().then(resolve).catch(reject);
            });
            return;
          }
          loadByUrl().then(resolve).catch(reject);
        };
        xhr.onerror = function () { loadByUrl().then(resolve).catch(reject); };
        xhr.send();
      });
    }

    return eaLoadPdfDocument().then(function (pdf) {
      container.innerHTML = '';
      var pagesWrap = document.createElement('div');
      pagesWrap.className = 'ea-protocol-pdf-pages';
      container.appendChild(pagesWrap);

      var chain = Promise.resolve();
      for (var i = 1; i <= pdf.numPages; i++) {
        (function (pageNum) {
          chain = chain.then(function () {
            return pdf.getPage(pageNum).then(function (page) {
              var baseViewport = page.getViewport({ scale: 1 });
              var wrapWidth = pagesWrap.clientWidth || container.clientWidth || 760;
              var scale = wrapWidth / baseViewport.width;
              var viewport = page.getViewport({ scale: scale });
              var canvas = document.createElement('canvas');
              canvas.className = 'ea-protocol-pdf-page';
              canvas.width = Math.floor(viewport.width);
              canvas.height = Math.floor(viewport.height);
              pagesWrap.appendChild(canvas);
              return page.render({
                canvasContext: canvas.getContext('2d'),
                viewport: viewport
              }).promise;
            });
          });
        })(i);
      }
      return chain;
    }).catch(function () {
      container.innerHTML = '<p class="ea-protocol-pdf-error">PDF yuklanmadi. Internetni tekshiring.</p>';
    });
  }

  function eaOpenProtocolDialog() {
    var dialog = document.getElementById('ea-protocol-dialog');
    var content = document.getElementById('ea-protocol-content');
    if (!dialog || !content) return;

    dialog.classList.add('is-open');
    dialog.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        dialog.classList.add('is-visible');
      });
    });

    eaRenderPdf(eaGetPdfPath(), content).then(function () {
      var body = dialog.querySelector('.ea-protocol-dialog__body');
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
    link.download = 'bayonnoma.pdf';
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
