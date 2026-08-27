const ARTICLE_CATEGORIES = [
    { id: 'all', label: 'All', tag: '' },
    { id: 'competitive-programming', label: 'Competitive Programming', tag: 'algorithms' },
    { id: 'ai-ml', label: 'AI/ML', tag: 'machinelearning' },
    { id: 'web', label: 'Web Development', tag: 'webdev' },
    { id: 'backend', label: 'Backend Systems', tag: 'backend' },
    { id: 'databases', label: 'Databases', tag: 'database' },
    { id: 'devops', label: 'DevOps', tag: 'devops' },
    { id: 'security', label: 'Cybersecurity', tag: 'security' },
    { id: 'opensource', label: 'Open Source', tag: 'opensource' },
    { id: 'career', label: 'Career', tag: 'career' }
];

const SOURCE_NAME = 'DEV Community';
const DEV_API_BASE = 'https://dev.to/api/articles';
let articles = [];
let activeCategory = 'all';
let searchTerm = '';
let sortMode = 'relevance';

function escapeHtml(value = '') {
    return value
        .toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getCategory() {
    return ARTICLE_CATEGORIES.find((category) => category.id === activeCategory) || ARTICLE_CATEGORIES[0];
}

function setStatus(message) {
    const status = document.getElementById('articlesStatus');
    if (status) status.textContent = message;
}

function renderSidebarProfileFromState() {
    const state = window.stateManager?.getState?.();
    const profile = state?.profile?.data;
    if (!profile) return;

    renderUnifiedSidebarProfile({
        name: profile?.user_profile?.display_name || profile?.username || 'User',
        avatarUrl: profile?.user_profile?.avatar_thumbnail || profile?.user_profile?.avatar_url || ''
    });
}

function normalizeArticle(item) {
    const publishedAt = item.published_at ? new Date(item.published_at) : null;
    return {
        id: item.id,
        title: item.title || 'Untitled article',
        description: item.description || 'Open the original article for the full post.',
        url: item.url,
        image: item.social_image || item.cover_image || '',
        author: item.user?.name || item.user?.username || SOURCE_NAME,
        source: SOURCE_NAME,
        tags: item.tag_list || [],
        readingTime: item.reading_time_minutes || 1,
        reactions: item.public_reactions_count || 0,
        comments: item.comments_count || 0,
        publishedAt,
        publishedLabel: publishedAt
            ? publishedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
            : 'Recently'
    };
}

function renderCategories() {
    const rail = document.getElementById('categoryRail');
    if (!rail) return;

    rail.innerHTML = ARTICLE_CATEGORIES.map((category) => `
        <button
            type="button"
            class="article-chip text-sm font-bold ${category.id === activeCategory ? 'active' : ''}"
            data-category="${category.id}"
        >
            ${escapeHtml(category.label)}
        </button>
    `).join('');

    rail.querySelectorAll('[data-category]').forEach((button) => {
        button.addEventListener('click', () => {
            activeCategory = button.dataset.category || 'all';
            loadArticles();
        });
    });
}

function renderSkeletons() {
    const grid = document.getElementById('articlesGrid');
    if (!grid) return;

    grid.innerHTML = Array.from({ length: 9 }, (_, index) => `
        <article class="glass article-card p-4">
            <div class="skeleton article-image rounded-2xl" style="--delay:-${(index * 0.12).toFixed(2)}s"></div>
            <div class="p-2 pt-5 space-y-4">
                <div class="skeleton h-4 w-24 rounded-full"></div>
                <div class="space-y-2">
                    <div class="skeleton h-6 w-full rounded-full"></div>
                    <div class="skeleton h-6 w-4/5 rounded-full"></div>
                </div>
                <div class="space-y-2">
                    <div class="skeleton h-3 w-full rounded-full"></div>
                    <div class="skeleton h-3 w-2/3 rounded-full"></div>
                </div>
            </div>
        </article>
    `).join('');
}

function filterAndSort(items) {
    const query = searchTerm.trim().toLowerCase();
    const filtered = query
        ? items.filter((item) => {
            const haystack = [item.title, item.description, item.author, item.tags.join(' ')].join(' ').toLowerCase();
            return haystack.includes(query);
        })
        : items;

    return filtered.slice().sort((a, b) => {
        if (sortMode === 'recent') {
            return (b.publishedAt?.getTime() || 0) - (a.publishedAt?.getTime() || 0);
        }
        if (sortMode === 'popular') {
            return (b.reactions + b.comments) - (a.reactions + a.comments);
        }
        return 0;
    });
}

function renderArticles() {
    const grid = document.getElementById('articlesGrid');
    if (!grid) return;

    const visibleArticles = filterAndSort(articles);
    if (!visibleArticles.length) {
        grid.innerHTML = `
            <div class="glass rounded-3xl p-10 text-center text-gray-300 md:col-span-2 2xl:col-span-3">
                <h2 class="text-2xl font-black text-white mb-2">No articles found</h2>
                <p class="text-gray-400">Try another category or search term.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = visibleArticles.map((article) => {
        const tags = article.tags.slice(0, 3).map((tag) => `
            <span class="article-meta-pill px-3 py-1 text-xs text-emerald-200">#${escapeHtml(tag)}</span>
        `).join('');
        const image = article.image
            ? `<img src="${escapeHtml(article.image)}" alt="" class="w-full h-full object-cover" loading="lazy" onerror="this.remove()">`
            : `<div class="grid h-full place-items-center text-5xl font-black text-emerald-300/70">${escapeHtml(article.title.charAt(0))}</div>`;

        return `
            <article class="glass article-card overflow-hidden hover:-translate-y-1 transition flex flex-col">
                <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer" class="article-image block overflow-hidden">
                    ${image}
                </a>
                <div class="p-5 flex flex-col flex-1">
                    <div class="flex flex-wrap items-center gap-2 text-xs text-gray-400 mb-4">
                        <span class="article-meta-pill px-3 py-1">${escapeHtml(article.source)}</span>
                        <span>${escapeHtml(article.publishedLabel)}</span>
                        <span>${article.readingTime} min read</span>
                    </div>
                    <h2 class="text-xl font-black leading-tight mb-3">
                        <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer" class="hover:text-emerald-300 transition">${escapeHtml(article.title)}</a>
                    </h2>
                    <p class="text-gray-400 text-sm leading-6 mb-5 flex-1">${escapeHtml(article.description)}</p>
                    <div class="flex flex-wrap gap-2 mb-5">${tags}</div>
                    <div class="flex items-center justify-between gap-4 mt-auto">
                        <p class="text-sm text-gray-400 truncate">By ${escapeHtml(article.author)}</p>
                        <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer" class="shrink-0 text-emerald-300 hover:text-white text-sm font-bold transition">Read original</a>
                    </div>
                </div>
            </article>
        `;
    }).join('');
}

async function fetchArticles(category) {
    const params = new URLSearchParams({ per_page: '24', top: '7' });
    if (category.tag) params.set('tag', category.tag);

    const response = await fetch(`${DEV_API_BASE}?${params.toString()}`, {
        headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
        throw new Error(`Article source returned ${response.status}`);
    }

    const payload = await response.json();
    return payload.map(normalizeArticle).filter((article) => article.url);
}

async function loadArticles() {
    const category = getCategory();
    renderCategories();
    renderSkeletons();
    setStatus(`Loading ${category.label.toLowerCase()} articles from public sources...`);

    try {
        articles = await fetchArticles(category);
        setStatus(`${articles.length} ${category.label.toLowerCase()} articles from ${SOURCE_NAME}.`);
        renderArticles();
    } catch (error) {
        console.error(error);
        articles = [];
        setStatus('Article feed is temporarily unavailable.');
        renderArticles();
    }
}

function initializeArticlesPage() {
    showMainApp();
    renderSidebarProfileFromState();
    window.stateManager?.subscribe?.(() => renderSidebarProfileFromState());
    renderCategories();

    const search = document.getElementById('articleSearch');
    const sort = document.getElementById('articleSort');

    search?.addEventListener('input', () => {
        searchTerm = search.value || '';
        renderArticles();
    });

    sort?.addEventListener('change', () => {
        sortMode = sort.value || 'relevance';
        renderArticles();
    });

    loadArticles();
}

document.addEventListener('DOMContentLoaded', initializeArticlesPage);
