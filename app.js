import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';

const DATA_URL = './data/contents.json';

const els = {
  canvases: [
    document.getElementById('pdfCanvasLeft'),
    document.getElementById('pdfCanvasRight')
  ],
  spread: document.getElementById('pdfSpread'),
  viewport: document.getElementById('pdfViewport'),
  loading: document.getElementById('loadingMessage'),
  tocList: document.getElementById('tocList'),
  search: document.getElementById('searchInput'),
  clearSearch: document.getElementById('clearSearchButton'),
  resultCount: document.getElementById('resultCount'),
  pageInput: document.getElementById('pageNumberInput'),
  pageCount: document.getElementById('pageCountLabel'),
  prevPage: document.getElementById('prevPageButton'),
  nextPage: document.getElementById('nextPageButton'),
  prevUnit: document.getElementById('prevUnitButton'),
  nextUnit: document.getElementById('nextUnitButton'),
  zoomOut: document.getElementById('zoomOutButton'),
  zoomIn: document.getElementById('zoomInButton'),
  zoomLabel: document.getElementById('zoomLabel'),
  fitWidth: document.getElementById('fitWidthButton'),
  unitBadge: document.getElementById('unitBadge'),
  unitTitle: document.getElementById('unitTitle'),
  unitSummary: document.getElementById('unitSummary'),
  unitKeywords: document.getElementById('unitKeywords'),
  sidebar: document.getElementById('sidebar'),
  menuButton: document.getElementById('menuButton'),
  toast: document.getElementById('toast')
};

const contexts = els.canvases.map(canvas => canvas.getContext('2d', { alpha: false }));
const pdfCache = new Map();
let pdfDoc = null;
let currentPdfUrl = '';
let contents = [];
let currentPage = 3;
let currentUnitId = '';
let currentGrade = 'C';
let scale = 1.05;
let fitWidthMode = true;
let currentTypeFilter = 'all';
let currentGradeFilter = 'all';
let renderTasks = [];
let renderSerial = 0;

function normalize(text) {
  return (text || '')
    .toString()
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s・,，。()（）①②③④⑤⑥⑦⑧⑨]/g, '');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[ch]));
}

function getCurrentGradeUnits() {
  return contents.filter(item => item.grade === currentGrade);
}

function getUnitForPage(page) {
  return getCurrentGradeUnits().find(item => page >= item.startPage && page <= item.endPage) || null;
}

function getVisibleUnits() {
  const query = normalize(els.search.value);
  return contents.filter(item => {
    const gradeOk = currentGradeFilter === 'all' || item.grade === currentGradeFilter;
    const typeOk = currentTypeFilter === 'all' || item.type === currentTypeFilter;
    const haystack = normalize([item.grade, item.code, item.title, item.summary, ...item.keywords].join(' '));
    return gradeOk && typeOk && (!query || haystack.includes(query));
  });
}

function getNavigationUnits() {
  const visible = getVisibleUnits();
  return visible.length ? visible : contents;
}

function setUrlState() {
  const unit = getUnitForPage(currentPage);
  const params = new URLSearchParams();
  if (unit) params.set('unit', unit.id);
  params.set('grade', currentGrade);
  params.set('page', String(currentPage));
  history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
}

function readInitialUnit() {
  const params = new URLSearchParams(location.search);
  const unitId = params.get('unit');
  const grade = params.get('grade');
  const page = Number(params.get('page'));
  let unit = contents.find(item => item.id === unitId);
  if (!unit && grade) unit = contents.find(item => item.grade === grade);
  if (!unit) unit = contents[0];
  if (Number.isInteger(page) && page >= unit.startPage && page <= unit.endPage) {
    return { unit, page };
  }
  return { unit, page: unit.startPage };
}

function updateUnitInfo() {
  const unit = getUnitForPage(currentPage);
  if (!unit) {
    els.unitBadge.textContent = `${currentGrade}案内`;
    els.unitTitle.textContent = currentPage <= 2 ? '目次・白紙ページ' : '案内ページ';
    els.unitSummary.textContent = '左側の検索目次から単元を選択してください。';
    els.unitKeywords.innerHTML = '';
    currentUnitId = '';
  } else {
    currentUnitId = unit.id;
    els.unitBadge.textContent = unit.code;
    els.unitTitle.textContent = unit.title;
    els.unitSummary.textContent = unit.summary;
    els.unitKeywords.innerHTML = unit.keywords
      .map(keyword => `<span class="keyword">${escapeHtml(keyword)}</span>`)
      .join('');
  }

  document.querySelectorAll('.toc-item').forEach(button => {
    button.classList.toggle('active', button.dataset.id === currentUnitId);
  });

  const navUnits = getNavigationUnits();
  const index = navUnits.findIndex(item => item.id === currentUnitId);
  els.prevUnit.disabled = index <= 0;
  els.nextUnit.disabled = index < 0 || index >= navUnits.length - 1;
}

function renderToc() {
  const filtered = getVisibleUnits();
  els.resultCount.textContent = `${filtered.length}件 / 全${contents.length}単元`;

  if (!filtered.length) {
    els.tocList.innerHTML = '<div class="empty-result">該当する単元がありません。<br>別の条件で検索してください。</div>';
    updateUnitInfo();
    return;
  }

  els.tocList.innerHTML = filtered.map(item => `
    <button class="toc-item ${item.id === currentUnitId ? 'active' : ''}"
      data-id="${item.id}">
      <span class="toc-code">${escapeHtml(item.code)}</span>
      <span class="toc-title">${escapeHtml(item.title)}</span>
      <span class="toc-page">p.${item.startPage}-${item.endPage}</span>
    </button>
  `).join('');

  els.tocList.querySelectorAll('.toc-item').forEach(button => {
    button.addEventListener('click', async () => {
      const unit = contents.find(item => item.id === button.dataset.id);
      if (unit) await goToUnit(unit);
      if (window.innerWidth <= 850) els.sidebar.classList.remove('open');
    });
  });
  updateUnitInfo();
}

function cancelRenders() {
  renderTasks.forEach(task => {
    try { task?.cancel(); } catch (_) {}
  });
  renderTasks = [];
}

async function loadPdf(pdfUrl) {
  if (currentPdfUrl === pdfUrl && pdfDoc) return pdfDoc;
  els.loading.style.display = 'block';
  els.loading.textContent = 'PDFを読み込んでいます...';
  els.spread.style.display = 'none';
  cancelRenders();

  if (!pdfCache.has(pdfUrl)) {
    pdfCache.set(pdfUrl, pdfjsLib.getDocument(pdfUrl).promise);
  }
  pdfDoc = await pdfCache.get(pdfUrl);
  currentPdfUrl = pdfUrl;
  els.pageInput.max = pdfDoc.numPages;
  return pdfDoc;
}

async function renderCanvas(pageNumber, canvas, context, targetScale, serial) {
  if (pageNumber > pdfDoc.numPages) {
    canvas.style.display = 'none';
    return;
  }

  const page = await pdfDoc.getPage(pageNumber);
  if (serial !== renderSerial) return;
  const viewport = page.getViewport({ scale: targetScale });
  const outputScale = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;
  canvas.style.display = 'block';

  const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
  const task = page.render({ canvasContext: context, transform, viewport });
  renderTasks.push(task);
  try {
    await task.promise;
  } catch (error) {
    if (error?.name !== 'RenderingCancelledException') throw error;
  }
}

async function renderSpread() {
  if (!pdfDoc) return;
  const serial = ++renderSerial;
  cancelRenders();

  currentPage = Math.min(Math.max(currentPage, 1), pdfDoc.numPages);
  const firstPage = await pdfDoc.getPage(currentPage);
  let targetScale = scale;

  if (fitWidthMode) {
    const baseViewport = firstPage.getViewport({ scale: 1 });
    const outerPadding = window.innerWidth <= 850 ? 24 : 48;
    const availableWidth = Math.max(280, els.viewport.clientWidth - outerPadding);
    targetScale = Math.min(2.3, availableWidth / baseViewport.width);
    scale = targetScale;
  }

  // iPad Chromeでも確実に2ページ表示されるよう、順番にレンダリングします。
  await renderCanvas(currentPage, els.canvases[0], contexts[0], targetScale, serial);
  if (serial !== renderSerial) return;
  await new Promise(resolve => requestAnimationFrame(resolve));
  await renderCanvas(currentPage + 1, els.canvases[1], contexts[1], targetScale, serial);
  if (serial !== renderSerial) return;

  els.loading.style.display = 'none';
  els.spread.style.display = 'flex';
  els.pageInput.value = currentPage;
  els.pageCount.textContent = `/ ${pdfDoc.numPages}`;
  els.prevPage.disabled = currentPage <= 1;
  els.nextPage.disabled = currentPage + 1 >= pdfDoc.numPages;
  els.zoomLabel.textContent = `${Math.round(scale * 100)}%`;
  updateUnitInfo();
  renderToc();
  setUrlState();
}

async function goToUnit(unit) {
  if (!unit) return;
  currentGrade = unit.grade;
  currentPage = unit.startPage;
  currentUnitId = unit.id;
  els.viewport.scrollTop = 0;
  els.viewport.scrollLeft = 0;
  await loadPdf(unit.pdf);
  await renderSpread();
}

function goToPage(page) {
  if (!pdfDoc) return;
  currentPage = Math.min(Math.max(Math.trunc(page), 1), pdfDoc.numPages);
  els.viewport.scrollTop = 0;
  els.viewport.scrollLeft = 0;
  renderSpread().catch(showError);
}

function goToRelativeUnit(offset) {
  const navUnits = getNavigationUnits();
  const index = navUnits.findIndex(item => item.id === currentUnitId);
  const next = navUnits[index + offset];
  if (next) goToUnit(next).catch(showError);
}

function showError(error) {
  console.error(error);
  els.loading.style.display = 'block';
  const pdfLink = currentPdfUrl || './pdf/sansu_C.pdf';
  els.loading.innerHTML = `PDFを表示できませんでした。通信環境を確認して再読み込みしてください。<br><a href="${pdfLink}" target="_blank" rel="noopener">PDFを別画面で開く</a>`;
}

els.search.addEventListener('input', renderToc);
els.clearSearch.addEventListener('click', () => {
  els.search.value = '';
  renderToc();
  els.search.focus();
});

document.querySelectorAll('.grade-chip').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.grade-chip').forEach(chip => chip.classList.remove('active'));
    button.classList.add('active');
    currentGradeFilter = button.dataset.grade;
    renderToc();
  });
});

document.querySelectorAll('.type-chip').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.type-chip').forEach(chip => chip.classList.remove('active'));
    button.classList.add('active');
    currentTypeFilter = button.dataset.filter;
    renderToc();
  });
});

els.prevPage.addEventListener('click', () => goToPage(currentPage - 2));
els.nextPage.addEventListener('click', () => goToPage(currentPage + 2));
els.prevUnit.addEventListener('click', () => goToRelativeUnit(-1));
els.nextUnit.addEventListener('click', () => goToRelativeUnit(1));
els.pageInput.addEventListener('change', () => goToPage(Number(els.pageInput.value)));
els.zoomOut.addEventListener('click', () => {
  fitWidthMode = false;
  scale = Math.max(0.35, scale - 0.1);
  renderSpread().catch(showError);
});
els.zoomIn.addEventListener('click', () => {
  fitWidthMode = false;
  scale = Math.min(3, scale + 0.1);
  renderSpread().catch(showError);
});
els.fitWidth.addEventListener('click', () => {
  fitWidthMode = true;
  renderSpread().catch(showError);
});
els.menuButton.addEventListener('click', () => els.sidebar.classList.toggle('open'));
window.addEventListener('resize', () => {
  clearTimeout(window.__resizeTimer);
  window.__resizeTimer = setTimeout(() => {
    if (fitWidthMode) renderSpread().catch(showError);
  }, 150);
});
window.addEventListener('keydown', event => {
  if (event.target.matches('input')) return;
  if (event.key === 'ArrowLeft') goToPage(currentPage - 2);
  if (event.key === 'ArrowRight') goToPage(currentPage + 2);
  if (event.key === '/') {
    event.preventDefault();
    els.search.focus();
  }
});

async function init() {
  const contentsResponse = await fetch(DATA_URL);
  if (!contentsResponse.ok) throw new Error('目次データを読み込めません。');
  contents = await contentsResponse.json();
  const initial = readInitialUnit();
  currentGrade = initial.unit.grade;
  currentPage = initial.page;
  currentUnitId = initial.unit.id;
  renderToc();
  await loadPdf(initial.unit.pdf);
  await renderSpread();
}

init().catch(showError);
