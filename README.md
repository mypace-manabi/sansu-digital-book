const PDF_URL = './pdf/sansu_F.pdf';
const DATA_URL = './data/contents.json';

const els = {
  frame: document.getElementById('pdfFrame'),
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
  unitBadge: document.getElementById('unitBadge'),
  unitTitle: document.getElementById('unitTitle'),
  unitSummary: document.getElementById('unitSummary'),
  unitKeywords: document.getElementById('unitKeywords'),
  sidebar: document.getElementById('sidebar'),
  menuButton: document.getElementById('menuButton'),
  toast: document.getElementById('toast')
};

let contents = [];
let currentPage = 3;
let currentUnitId = 'f18';
let currentFilter = 'all';
const totalPages = 48;

function normalize(text) {
  return (text || '').toString().normalize('NFKC').toLowerCase()
    .replace(/[\s・,，。()（）①②③④⑤⑥⑦⑧⑨]/g, '');
}
function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
function getUnitForPage(page) {
  return contents.find(item => page >= item.startPage && page <= item.endPage) || null;
}
function getUnitIndex(id) { return contents.findIndex(item => item.id === id); }
function setUrlState() {
  const unit = getUnitForPage(currentPage);
  const params = new URLSearchParams();
  if (unit) params.set('unit', unit.id);
  params.set('page', String(currentPage));
  history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
}
function readInitialState() {
  const params = new URLSearchParams(location.search);
  const unitId = params.get('unit');
  const page = Number(params.get('page'));
  const unit = contents.find(item => item.id === unitId);
  if (Number.isInteger(page) && page >= 1 && page <= totalPages) currentPage = page;
  else if (unit) currentPage = unit.startPage;
}
function updateUnitInfo() {
  const unit = getUnitForPage(currentPage);
  if (!unit) {
    els.unitBadge.textContent = '案内';
    els.unitTitle.textContent = currentPage === 1 ? '目次' : '白紙ページ';
    els.unitSummary.textContent = currentPage === 1 ? 'PDF本体の目次です。' : '見開き印刷を想定した白紙ページです。';
    els.unitKeywords.innerHTML = '';
    currentUnitId = '';
  } else {
    currentUnitId = unit.id;
    els.unitBadge.textContent = unit.code;
    els.unitTitle.textContent = unit.title;
    els.unitSummary.textContent = unit.summary;
    els.unitKeywords.innerHTML = unit.keywords.map(k => `<span class="keyword">${escapeHtml(k)}</span>`).join('');
  }
  document.querySelectorAll('.toc-item').forEach(button => button.classList.toggle('active', button.dataset.id === currentUnitId));
  const index = getUnitIndex(currentUnitId);
  els.prevUnit.disabled = index <= 0;
  els.nextUnit.disabled = index < 0 || index >= contents.length - 1;
}
function renderToc() {
  const query = normalize(els.search.value);
  const filtered = contents.filter(item => {
    const filterOk = currentFilter === 'all' || item.type === currentFilter;
    const haystack = normalize([item.code, item.title, item.summary, ...item.keywords].join(' '));
    return filterOk && (!query || haystack.includes(query));
  });
  els.resultCount.textContent = `${filtered.length}件 / 全${contents.length}単元`;
  if (!filtered.length) {
    els.tocList.innerHTML = '<div class="empty-result">該当する単元がありません。<br>別の言葉で検索してください。</div>';
    return;
  }
  els.tocList.innerHTML = filtered.map(item => `
    <button class="toc-item ${item.id === currentUnitId ? 'active' : ''}" data-id="${item.id}" data-page="${item.startPage}">
      <span class="toc-code">${escapeHtml(item.code)}</span>
      <span class="toc-title">${escapeHtml(item.title)}</span>
      <span class="toc-page">p.${item.startPage}</span>
    </button>`).join('');
  els.tocList.querySelectorAll('.toc-item').forEach(button => button.addEventListener('click', () => {
    goToPage(Number(button.dataset.page));
    if (window.innerWidth <= 850) els.sidebar.classList.remove('open');
  }));
}
function loadPdfPage() {
  // Chrome/Edgeの内蔵PDFビューアーは、同じPDFの#pageだけを変更しても
  // iframe内でページ移動しないことがあります。クエリ文字列を毎回変えて
  // PDFを確実に再読込し、指定ページへ移動させます。
  const viewerUrl = `${PDF_URL}?view=${currentPage}-${Date.now()}#page=${currentPage}&zoom=page-width&toolbar=1&navpanes=0`;
  els.loading.style.display = 'block';
  els.loading.textContent = `PDFの${currentPage}ページを開いています...`;
  els.frame.style.display = 'none';
  els.frame.src = 'about:blank';
  requestAnimationFrame(() => {
    els.frame.src = viewerUrl;
  });
  els.pageInput.value = currentPage;
  els.pageCount.textContent = `/ ${totalPages}`;
  els.prevPage.disabled = currentPage <= 1;
  els.nextPage.disabled = currentPage >= totalPages;
  updateUnitInfo();
  renderToc();
  setUrlState();
}
function goToPage(page) {
  currentPage = Math.min(Math.max(Math.trunc(page || 1), 1), totalPages);
  loadPdfPage();
}
function goToRelativeUnit(offset) {
  const next = contents[getUnitIndex(currentUnitId) + offset];
  if (next) goToPage(next.startPage);
}
function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 1800);
}
function showError(error) {
  console.error(error);
  els.loading.style.display = 'block';
  els.loading.innerHTML = '目次データを読み込めませんでした。<br><a href="./data/contents.json" target="_blank">contents.jsonを確認</a>してください。';
}

els.search.addEventListener('input', renderToc);
els.clearSearch.addEventListener('click', () => { els.search.value = ''; renderToc(); els.search.focus(); });
document.querySelectorAll('.filter-chip').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
  button.classList.add('active'); currentFilter = button.dataset.filter; renderToc();
}));
els.prevPage.addEventListener('click', () => goToPage(currentPage - 1));
els.nextPage.addEventListener('click', () => goToPage(currentPage + 1));
els.prevUnit.addEventListener('click', () => goToRelativeUnit(-1));
els.nextUnit.addEventListener('click', () => goToRelativeUnit(1));
els.pageInput.addEventListener('change', () => goToPage(Number(els.pageInput.value)));
els.menuButton.addEventListener('click', () => els.sidebar.classList.toggle('open'));
els.frame.addEventListener('load', () => {
  if (els.frame.src === 'about:blank') return;
  els.loading.style.display = 'none';
  els.frame.style.display = 'block';
});

window.addEventListener('keydown', event => {
  if (event.target.matches('input')) return;
  if (event.key === 'ArrowLeft') goToPage(currentPage - 1);
  if (event.key === 'ArrowRight') goToPage(currentPage + 1);
  if (event.key === '/') { event.preventDefault(); els.search.focus(); }
});

async function init() {
  const response = await fetch(DATA_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`contents.json: ${response.status}`);
  contents = await response.json();
  readInitialState();
  loadPdfPage();
}
init().catch(showError);
