const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  user: null,
  demoMode: true,
  posts: [],
  mode: 'Для тебя',
  category: 'Все',
  route: 'feed',
  routeParam: null,
  searchTimer: null,
  theme: localStorage.getItem('sasavot-theme') || 'dark'
};

const navItems = [
  ['feed', 'house', 'Главная'],
  ['popular', 'trend-up', 'Популярное'],
  ['tiktok', 'video', 'TikTok'],
  ['clips', 'film-strip', 'Клипы'],
  ['irl', 'camera', 'IRL'],
  ['creative', 'paint-brush-broad', 'Творчество'],
  ['memes', 'smiley-wink', 'Мемы'],
  ['subscriptions', 'users-three', 'Подписки'],
  ['favorites', 'bookmark-simple', 'Избранное'],
  ['notifications', 'bell', 'Уведомления'],
  ['profile', 'user-circle', 'Профиль']
];

const mobileItems = [
  ['feed', 'house', 'Главная'],
  ['popular', 'trend-up', 'Топ'],
  ['publish', 'plus-circle', 'Создать'],
  ['notifications', 'bell', 'События'],
  ['profile', 'user-circle', 'Профиль']
];

const reactionIcons = { heart: '❤️', laugh: '😂', fire: '🔥', skull: '💀', clown: '🤡' };
const categoryMap = { popular: 'Все', clips: 'Клипы', irl: 'IRL', creative: 'Творчество', memes: 'Мемы', tiktok: 'TikTok' };
const routeTitles = { clips: ['Клипы', 'Лучшие моменты со стримов, которые хочется пересмотреть.'], irl: ['IRL зрителей', 'Встречи, поездки и реальная жизнь нашего комьюнити.'], creative: ['Творчество', 'Арты, монтажи, музыка, 3D и дизайн от зрителей.'], memes: ['Мемы', 'Внутренние шутки. Иногда контекст уже никто не помнит.'] };

function escapeHTML(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function formatNumber(value) {
  return new Intl.NumberFormat('ru-RU', { notation: value > 9999 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value || 0);
}

function timeAgo(date) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(date)) / 1000));
  if (seconds < 60) return 'только что';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} мин назад`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} ч назад`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} дн назад`;
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(date));
}

async function api(path, options = {}) {
  const config = { credentials: 'same-origin', headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers }, ...options };
  const response = await fetch(path, config);
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Не удалось выполнить запрос.');
  return payload;
}

function toast(message, icon = 'check-circle') {
  const element = document.createElement('div');
  element.className = 'toast';
  element.innerHTML = `<i class="ph ph-${icon}"></i><span>${escapeHTML(message)}</span>`;
  $('#toast-root').append(element);
  setTimeout(() => element.remove(), 3600);
}

function avatar(user, size = '') {
  return `<span class="avatar ${size}">${escapeHTML(user?.avatar || user?.username?.[0]?.toUpperCase() || 'С')}</span>`;
}

function icon(name, fill = false) {
  return `<i class="${fill ? 'ph-fill' : 'ph'} ph-${name}" aria-hidden="true"></i>`;
}

function syncNavigation() {
  const normalized = state.route === 'popular' ? 'popular' : state.route;
  $$('.nav-item, .mobile-nav button').forEach((item) => item.classList.toggle('active', item.dataset.route === normalized));
}

function renderNavigation() {
  const canModerate = ['Модератор', 'Старший модератор', 'Администратор', 'Владелец'].includes(state.user?.role);
  const effectiveNav = canModerate ? [...navItems, ['moderation', 'shield-check', 'Модерация']] : navItems;
  $('#primary-nav').innerHTML = effectiveNav.map(([route, glyph, label]) => `
    <button class="nav-item" type="button" data-route="${route}">
      ${icon(glyph)}<span>${label}</span>${route === 'notifications' ? '<b class="nav-count" id="nav-notification-count"></b>' : ''}
    </button>`).join('');
  $('#mobile-nav').innerHTML = mobileItems.map(([route, glyph, label]) => `
    <button type="button" data-${route === 'publish' ? 'action' : 'route'}="${route}">${icon(glyph)}<span>${label}</span></button>`).join('');
}

function updateAccount() {
  renderNavigation();
  syncNavigation();
  const button = $('#account-button');
  if (!state.user) {
    button.className = 'account-button';
    button.innerHTML = 'Войти';
    $('#notification-dot').hidden = true;
    return;
  }
  button.className = 'account-button user';
  button.innerHTML = `${avatar(state.user, 'small')}<span>@${escapeHTML(state.user.username)}</span>`;
  api('/api/notifications').then(({ notifications }) => {
    const count = notifications.filter((item) => !item.read).length;
    $('#notification-dot').hidden = count === 0;
    const navCount = $('#nav-notification-count');
    if (navCount) navCount.textContent = count || '';
  }).catch(() => {});
}

function renderRightRail() {
  const top = [...state.posts].sort((a, b) => totalReactions(b) - totalReactions(a)).slice(0, 5);
  const authors = [...new Map(state.posts.map((post) => [post.author.id, post.author])).values()].sort((a, b) => b.rating - a.rating).slice(0, 4);
  $('#right-rail').innerHTML = `
    <section class="rail-card">
      <h2 class="rail-heading">Сейчас в тренде <span>24 часа</span></h2>
      <div class="trend-list">${top.map((post, index) => `
        <button class="trend-item" type="button" data-post="${post.id}">
          <span class="trend-index">0${index + 1}</span>
          <span><strong>${escapeHTML(post.title)}</strong><small>${formatNumber(totalReactions(post))} реакций</small></span>
        </button>`).join('')}</div>
    </section>
    <section class="rail-card">
      <h2 class="rail-heading">Топ авторов недели <span>Рейтинг</span></h2>
      ${authors.map((author) => `
        <button class="author-rank" type="button" data-profile="${escapeHTML(author.username)}">
          ${avatar(author, 'small')}<span><strong>${escapeHTML(author.displayName)}</strong><small>@${escapeHTML(author.username)}</small></span><b class="rank-score">${formatNumber(author.rating)}</b>
        </button>`).join('')}
    </section>
    <section class="rail-card">
      <h2 class="rail-heading">Сообщество <span>Сегодня</span></h2>
      <div class="community-stats">
        <div class="stat-cell"><strong>12 481</strong><span>участник</span></div>
        <div class="stat-cell"><strong>3 825</strong><span>публикаций</span></div>
        <div class="stat-cell"><strong>1 024</strong><span>за неделю</span></div>
      </div>
    </section>
    <section class="rail-card">
      <h2 class="rail-heading">Недавно с нами</h2>
      <div class="new-users">${authors.slice().reverse().map((user) => avatar(user, 'small')).join('')}</div>
    </section>`;
}

function totalReactions(post) {
  return Object.values(post.reactions || {}).reduce((sum, number) => sum + number, 0);
}

function postCard(post, index = 0) {
  const primaryReaction = post.viewerReaction ? reactionIcons[post.viewerReaction] : '🔥';
  const isPortrait = post.category === 'Творчество' || post.category === 'Мемы';
  const media = post.media ? `
    <div class="post-media ${isPortrait ? 'portrait' : ''} ${post.mediaType === 'video' ? 'media-video' : ''}" data-view-media="${escapeHTML(post.media)}">
      <img src="${escapeHTML(post.media)}" alt="${escapeHTML(post.title)}" loading="${index > 0 ? 'lazy' : 'eager'}" width="1200" height="675">
      ${post.mediaType === 'video' ? `<span class="play-button">${icon('play', true)}</span><span class="duration">${escapeHTML(post.duration || '00:24')}</span>` : ''}
    </div>` : '';
  return `
    <article class="post-card" data-post-id="${post.id}" style="animation-delay:${Math.min(index * 55, 220)}ms">
      <div class="post-body">
        <header class="post-author">
          <button type="button" data-profile="${escapeHTML(post.author.username)}">${avatar(post.author)}</button>
          <div class="author-details">
            <div class="author-line"><strong>${escapeHTML(post.author.displayName)}</strong>${post.author.verified ? `<span class="verified" title="Проверенный автор">${icon('seal-check', true)}</span>` : ''}<span class="role">${escapeHTML(post.author.role)}</span></div>
            <div class="post-meta">@${escapeHTML(post.author.username)} • ${timeAgo(post.createdAt)} • ${escapeHTML(post.category)}</div>
          </div>
          <button class="post-menu" type="button" data-action="post-menu" aria-label="Меню публикации">${icon('dots-three')}</button>
        </header>
        <h2>${escapeHTML(post.title)}</h2>
        <p>${escapeHTML(post.body)}</p>
        <div class="tag-list">${(post.tags || []).map((tag) => `<button class="tag-link" type="button" data-search="#${escapeHTML(tag)}">#${escapeHTML(tag)}</button>`).join('')}</div>
      </div>
      ${media}
      <footer class="post-actions">
        <div class="reaction-wrap">
          <button class="action-button ${post.viewerReaction ? 'active' : ''}" type="button" data-reaction="${post.viewerReaction || 'fire'}"><span>${primaryReaction}</span><span>${formatNumber(totalReactions(post))}</span></button>
          <div class="reaction-picker" aria-label="Выбрать реакцию">${Object.entries(reactionIcons).map(([type, glyph]) => `<button type="button" data-reaction="${type}" aria-label="${type}">${glyph}</button>`).join('')}</div>
        </div>
        <button class="action-button" type="button" data-comments="${post.id}">${icon('chat-circle')}<span>${formatNumber(post.comments)}</span></button>
        <span class="action-button" title="Просмотры">${icon('eye')}<span>${formatNumber(post.views)}</span></span>
        <button class="action-button push-right ${post.bookmarked ? 'active' : ''}" type="button" data-bookmark="${post.id}" aria-label="В избранное">${icon('bookmark-simple', post.bookmarked)}</button>
        <button class="action-button" type="button" data-share="${post.id}" aria-label="Поделиться">${icon('share-network')}</button>
      </footer>
    </article>`;
}

function welcomeBlock() {
  return `
    <section class="welcome">
      <div class="welcome-copy">
        <div class="welcome-kicker"><span class="live-pulse"></span> САСАВОТ COMMUNITY</div>
        <h1>Весь движ начинается здесь.</h1>
        <p>Клипы, мемы, творчество и IRL нашего комьюнити.</p>
      </div>
      <div class="welcome-art" role="img" aria-label="Встреча сообщества"></div>
    </section>`;
}

function feedToolbar() {
  const modes = ['Для тебя', 'Новое', 'Популярное', 'Подписки'];
  const categories = ['Все', 'TikTok', 'Клипы', 'IRL', 'Творчество', 'Мемы'];
  return `
    <div class="feed-toolbar">
      <div class="mode-tabs">${modes.map((mode) => `<button type="button" class="tab-button ${state.mode === mode ? 'active' : ''}" data-mode="${mode}">${mode}</button>`).join('')}</div>
      <div class="category-scroll">${categories.map((category) => `<button type="button" class="filter-chip ${state.category === category ? 'active' : ''}" data-category="${category}">${category}</button>`).join('')}</div>
    </div>`;
}

async function loadFeed() {
  $('#main').innerHTML = `${state.route === 'feed' ? welcomeBlock() : ''}${feedToolbar()}<div class="feed-list"><div class="skeleton post-skeleton"></div></div>`;
  try {
    const payload = await api(`/api/feed?mode=${encodeURIComponent(state.mode)}&category=${encodeURIComponent(state.category)}`);
    state.posts = payload.posts;
    const list = $('.feed-list');
    list.innerHTML = state.posts.length ? state.posts.map(postCard).join('') : emptyState('tray', 'Здесь пока тихо', 'Выберите другой раздел или подпишитесь на новых авторов.');
    renderRightRail();
  } catch (error) {
    $('.feed-list').innerHTML = errorState(error.message);
  }
}

async function renderCategory(route) {
  state.category = categoryMap[route];
  state.mode = route === 'popular' ? 'Популярное' : 'Новое';
  if (route === 'popular') return loadFeed();
  if (route === 'tiktok') return renderTikTok();
  $('#main').innerHTML = `<header class="section-header"><div><h1>${routeTitles[route][0]}</h1><p>${routeTitles[route][1]}</p></div>${route === 'memes' ? '<button class="secondary-button" type="button" data-action="random-meme">Случайный мем</button>' : ''}</header>${feedToolbar()}<div class="feed-list"><div class="skeleton post-skeleton"></div></div>`;
  try {
    const { posts } = await api(`/api/feed?mode=${encodeURIComponent(state.mode)}&category=${encodeURIComponent(state.category)}`);
    state.posts = posts;
    if (route === 'creative' || route === 'irl') {
      $('.feed-list').className = 'masonry';
      $('.masonry').innerHTML = posts.length ? posts.concat(posts).map((post, index) => `
        <article class="masonry-card" data-view-media="${escapeHTML(post.media)}">
          <img src="${escapeHTML(post.media)}" alt="${escapeHTML(post.title)}" loading="lazy">
          <div class="masonry-copy"><strong>${escapeHTML(index > posts.length - 1 ? `${post.title}: вариация` : post.title)}</strong><span>@${escapeHTML(post.author.username)} • ${formatNumber(totalReactions(post))} реакций</span></div>
        </article>`).join('') : emptyState('paint-brush', 'Работы появятся здесь', 'Опубликуйте первую работу в этой категории.');
    } else {
      $('.feed-list').innerHTML = posts.length ? posts.map(postCard).join('') : emptyState('tray', 'Ничего не найдено', 'В этой категории пока нет публикаций.');
    }
    renderRightRail();
  } catch (error) { $('.feed-list').innerHTML = errorState(error.message); }
}

async function renderTikTok() {
  $('#main').innerHTML = `<header class="section-header"><div><h1>TikTok</h1><p>Вертикальные истории комьюнити. Листайте и выбирайте реакцию.</p></div></header><div class="tiktok-stage"><div class="skeleton post-skeleton"></div></div>`;
  try {
    const { posts } = await api('/api/feed?category=TikTok');
    state.posts = posts.length ? posts : state.posts.slice(0, 2);
    $('.tiktok-stage').innerHTML = state.posts.map((post) => `
      <article class="tiktok-card" data-post-id="${post.id}">
        <img src="${escapeHTML(post.media)}" alt="${escapeHTML(post.title)}">
        <span class="tiktok-play">${icon('play', true)}</span>
        <div class="tiktok-copy"><strong>@${escapeHTML(post.author.username)}</strong><p>${escapeHTML(post.body)}</p></div>
        <div class="tiktok-actions">
          <button type="button" data-reaction="fire" aria-label="Огонь">🔥</button>
          <button type="button" data-comments="${post.id}" aria-label="Комментарии">${icon('chat-circle')}</button>
          <button type="button" data-bookmark="${post.id}" aria-label="Избранное">${icon('bookmark-simple')}</button>
          <button type="button" data-share="${post.id}" aria-label="Поделиться">${icon('share-network')}</button>
        </div>
      </article>`).join('');
  } catch (error) { $('.tiktok-stage').innerHTML = errorState(error.message); }
}

async function renderProfile(username = state.user?.username || 'melnikova') {
  $('#main').innerHTML = `<div class="skeleton hero-skeleton"></div><div class="skeleton post-skeleton"></div>`;
  try {
    const { user, posts, following } = await api(`/api/users/${encodeURIComponent(username)}`);
    const isOwner = state.user?.id === user.id;
    const xpGoal = (user.level + 1) * 300;
    const xpCurrent = user.xp % xpGoal;
    $('#main').innerHTML = `
      <section class="profile-cover">
        <div class="profile-avatar">${avatar(user, 'large')}</div>
        <div class="profile-actions">${isOwner ? '<button class="secondary-button" type="button" data-action="logout">Выйти</button> <button class="primary-button" type="button" data-action="settings">Настроить профиль</button>' : `<button class="primary-button" type="button" data-follow="${user.id}">${following ? 'Вы подписаны' : 'Подписаться'}</button>`}</div>
      </section>
      <section class="profile-head">
        <div><div class="author-line"><h1>${escapeHTML(user.displayName)}</h1>${user.verified ? `<span class="verified">${icon('seal-check', true)}</span>` : ''}</div><div class="profile-handle">@${escapeHTML(user.username)} • ${escapeHTML(user.role)}</div><p class="profile-bio">${escapeHTML(user.bio || 'Пока без описания.')}</p></div>
      </section>
      <div class="profile-stats">
        ${profileStat(posts.length, 'Публикации')}${profileStat(user.followers, 'Подписчики')}${profileStat(user.following, 'Подписки')}${profileStat(user.reactionsReceived, 'Реакции')}${profileStat(user.views, 'Просмотры')}${profileStat(user.rating, 'Рейтинг')}
      </div>
      <section class="level-card"><div><span>LEVEL</span><div class="level-number">${user.level}</div></div><div><strong>${formatNumber(xpCurrent)} / ${formatNumber(xpGoal)} XP</strong><div class="xp-track"><div class="xp-fill" style="width:${Math.min(100, xpCurrent / xpGoal * 100)}%"></div></div></div><span>До нового уровня</span></section>
      <div class="profile-tabs"><button class="profile-tab active">Публикации</button><button class="profile-tab">Медиа</button><button class="profile-tab">Комментарии</button>${isOwner ? '<button class="profile-tab">Избранное</button>' : ''}<button class="profile-tab" data-action="achievements">Достижения</button></div>
      <div class="feed-list">${posts.length ? posts.map(postCard).join('') : emptyState('images', 'Публикаций пока нет', 'Здесь появятся новые работы автора.')}</div>`;
    state.posts = posts;
  } catch (error) { $('#main').innerHTML = errorState(error.message); }
}

function profileStat(value, label) {
  return `<div class="profile-stat"><strong>${formatNumber(value)}</strong><span>${label}</span></div>`;
}

async function renderNotifications() {
  if (!ensureAuth()) return;
  $('#main').innerHTML = `<header class="section-header"><div><h1>Уведомления</h1><p>Реакции, ответы, подписки и новости авторов.</p></div></header><div class="notification-list"><div class="skeleton hero-skeleton"></div></div>`;
  try {
    const { notifications } = await api('/api/notifications');
    $('.notification-list').innerHTML = notifications.length ? notifications.map((item) => `
      <article class="notification-item ${item.read ? '' : 'unread'}">
        <span class="notification-icon">${icon(item.type === 'reaction' ? 'heart' : item.type === 'comment' ? 'chat-circle' : 'user-plus')}</span>
        <div><strong>${escapeHTML(item.text)}</strong><small>${timeAgo(item.createdAt)}</small></div>
      </article>`).join('') : emptyState('bell-slash', 'Новых событий нет', 'Здесь появятся реакции и ответы других участников.');
  } catch (error) { $('.notification-list').innerHTML = errorState(error.message); }
}

async function renderFavorites() {
  if (!ensureAuth()) return;
  await loadFeed();
  const favorites = state.posts.filter((post) => post.bookmarked);
  $('#main').innerHTML = `<header class="section-header"><div><h1>Избранное</h1><p>Сохранённые публикации видны только вам.</p></div></header><div class="feed-list">${favorites.length ? favorites.map(postCard).join('') : emptyState('bookmark-simple', 'Пока ничего не сохранено', 'Нажмите на закладку под публикацией, чтобы вернуться к ней позже.')}</div>`;
}

async function renderSubscriptions() {
  if (!ensureAuth()) return;
  state.mode = 'Подписки';
  state.category = 'Все';
  await loadFeed();
}

async function renderModeration() {
  if (!ensureAuth()) return;
  $('#main').innerHTML = `<header class="section-header"><div><h1>Модерация</h1><p>Очередь жалоб с приоритетом и журналом решений.</p></div></header><div class="mod-list"><div class="skeleton hero-skeleton"></div></div>`;
  try {
    const { reports } = await api('/api/moderation/reports');
    $('.mod-list').innerHTML = reports.length ? reports.map((report) => `
      <article class="mod-item" data-report-id="${report.id}">
        <div class="priority">${report.priority}</div>
        <div class="mod-copy"><strong>${escapeHTML(report.reason)}</strong><p>${escapeHTML(report.details || 'Без дополнительного описания.')}</p><small>${escapeHTML(report.post?.title || 'Удалённая публикация')} • @${escapeHTML(report.reporter.username)} • ${timeAgo(report.createdAt)}</small></div>
        <div class="mod-actions"><button class="secondary-button" type="button" data-mod-action="reject">Отклонить</button><button class="danger-button" type="button" data-mod-action="hide">Скрыть пост</button></div>
      </article>`).join('') : emptyState('shield-check', 'Очередь пуста', 'Все жалобы уже рассмотрены.');
  } catch (error) { $('.mod-list').innerHTML = errorState(error.message); }
}

function renderRules() {
  $('#main').innerHTML = `<header class="section-header"><div><h1>Правила</h1><p>Коротко: уважайте людей и публикуйте то, за что готовы отвечать.</p></div></header>
    <div class="achievement-grid">
      ${rule('users', 'Уважение', 'Без травли, угроз, публикации личных данных и дискриминации.')}
      ${rule('copyright', 'Авторство', 'Указывайте автора работы. Не выдавайте чужой контент за свой.')}
      ${rule('warning', 'Безопасный контент', 'Запрещены опасные материалы, шок-контент и незаконные публикации.')}
      ${rule('megaphone', 'Без спама', 'Не дублируйте публикации и не используйте площадку только для рекламы.')}
    </div>`;
}

function renderAbout() {
  $('#main').innerHTML = `${welcomeBlock()}<header class="section-header"><div><h1>Сделано комьюнити</h1><p>SASAVOT Community собирает лучшие моменты зрителей в одном месте.</p></div></header><div class="achievement-grid">${rule('sparkle', 'Контент в центре', 'Лента быстро показывает новое, популярное и публикации подписок.')}${rule('shield-check', 'Безопасность', 'Роли, жалобы, журнал действий и защита критичных API встроены в основу.')}${rule('device-mobile', 'Везде удобно', 'Интерфейс собран для большого экрана и телефона с одинаковым вниманием.')}${rule('code', 'Открытая архитектура', 'Чистый frontend, Node API и Prisma-схема готовы к дальнейшему развитию.')}</div>`;
}

function rule(glyph, title, text) {
  return `<article class="achievement">${icon(glyph)}<div><strong>${title}</strong><small>${text}</small></div></article>`;
}

function emptyState(glyph, title, text) {
  return `<div class="empty-state">${icon(glyph)}<div><h2>${title}</h2><p>${text}</p></div></div>`;
}

function errorState(message) {
  return `<div class="empty-state">${icon('warning-circle')}<div><h2>Что-то пошло не так</h2><p>${escapeHTML(message)}</p></div></div>`;
}

function parseRoute() {
  const path = location.hash.replace(/^#\/?/, '') || 'feed';
  const [route, param] = path.split('/');
  state.route = route;
  state.routeParam = param ? decodeURIComponent(param) : null;
}

async function renderRoute() {
  parseRoute();
  syncNavigation();
  document.body.classList.remove('menu-open');
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (['popular', 'tiktok', 'clips', 'irl', 'creative', 'memes'].includes(state.route)) await renderCategory(state.route);
  else if (state.route === 'profile') await renderProfile(state.routeParam);
  else if (state.route === 'notifications') await renderNotifications();
  else if (state.route === 'favorites') await renderFavorites();
  else if (state.route === 'subscriptions') await renderSubscriptions();
  else if (state.route === 'moderation') await renderModeration();
  else if (state.route === 'rules') renderRules();
  else if (state.route === 'about') renderAbout();
  else {
    state.route = 'feed'; state.category = 'Все'; state.mode = 'Для тебя'; await loadFeed();
  }
}

function ensureAuth() {
  if (state.user) return true;
  openAuthModal();
  return false;
}

function openModal(title, content, wide = false) {
  $('#modal-root').innerHTML = `<div class="modal-backdrop"><section class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><h2 id="modal-title">${escapeHTML(title)}</h2><button class="modal-close" type="button" data-action="close-modal" aria-label="Закрыть">${icon('x')}</button></header><div class="modal-content">${content}</div></section></div>`;
  document.body.style.overflow = 'hidden';
  $('.modal-backdrop').addEventListener('click', (event) => { if (event.target === event.currentTarget) closeModal(); });
  setTimeout(() => $('.modal input, .modal button')?.focus(), 30);
}

function closeModal() {
  $('#modal-root').innerHTML = '';
  document.body.style.overflow = '';
}

function openAuthModal(tab = 'login') {
  const login = tab === 'login';
  openModal(login ? 'Вход в сообщество' : 'Создать аккаунт', `
    <div class="auth-tabs"><button type="button" class="${login ? 'active' : ''}" data-auth-tab="login">Вход</button><button type="button" class="${login ? '' : 'active'}" data-auth-tab="register">Регистрация</button></div>
    ${login && state.demoMode ? `<div class="demo-accounts"><button class="demo-account" type="button" data-demo-login="viewer"><strong>Зритель</strong><small>mira_viewer</small></button><button class="demo-account" type="button" data-demo-login="author"><strong>Автор</strong><small>melnikova</small></button><button class="demo-account" type="button" data-demo-login="mod"><strong>Модератор</strong><small>mod.ksenia</small></button></div>` : ''}
    <form id="auth-form" class="form-grid" data-auth-mode="${tab}">
      ${login ? `<div class="field"><label for="identity">Email или username</label><input id="identity" name="identity" autocomplete="username" required placeholder="mira_viewer"></div>` : `<div class="field"><label for="username">Username</label><input id="username" name="username" autocomplete="username" minlength="3" maxlength="24" required placeholder="mira_viewer"></div><div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required placeholder="you@example.com"></div>`}
      <div class="field"><label for="password">Пароль</label><input id="password" name="password" type="password" autocomplete="${login ? 'current-password' : 'new-password'}" minlength="10" required placeholder="Минимум 10 символов"></div>
      ${login ? '<label><input type="checkbox" name="remember"> Запомнить меня</label>' : '<label><input type="checkbox" name="rules" required> Я принимаю правила сообщества</label>'}
      <div id="auth-error"></div>
      <div class="form-actions"><button class="primary-button" type="submit">${login ? 'Войти' : 'Создать аккаунт'}</button></div>
    </form>`);
}

async function submitAuth(form) {
  const values = Object.fromEntries(new FormData(form));
  values.remember = Boolean(values.remember);
  try {
    const payload = await api(`/api/auth/${form.dataset.authMode}`, { method: 'POST', body: JSON.stringify(values) });
    if (form.dataset.authMode === 'register') {
      toast(payload.message);
      openAuthModal('login');
      return;
    }
    state.user = payload.user;
    closeModal();
    updateAccount();
    toast(`С возвращением, ${state.user.displayName}`);
    renderRoute();
  } catch (error) { $('#auth-error').innerHTML = `<div class="form-error">${escapeHTML(error.message)}</div>`; }
}

function demoLogin(type) {
  const accounts = { viewer: ['mira_viewer', 'viewer123!'], author: ['melnikova', 'author123!'], mod: ['mod.ksenia', 'mod12345!'] };
  $('#identity').value = accounts[type][0];
  $('#password').value = accounts[type][1];
  $('#auth-form').requestSubmit();
}

function openPublishModal() {
  if (!ensureAuth()) return;
  openModal('Новая публикация', `<form id="publish-form" class="form-grid" enctype="multipart/form-data">
    <div class="form-row"><div class="field"><label for="post-category">Категория</label><select id="post-category" name="category" required><option>TikTok</option><option>Клипы</option><option selected>IRL</option><option>Творчество</option><option>Мемы</option><option>Другое</option></select></div><div class="field"><label for="post-title">Название</label><input id="post-title" name="title" maxlength="120" required placeholder="Коротко о публикации"></div></div>
    <div class="field"><label for="post-body">Описание</label><textarea id="post-body" name="body" maxlength="4000" required placeholder="Расскажите, что происходит"></textarea></div>
    <div class="field"><label for="post-tags">Хэштеги</label><input id="post-tags" name="tags" placeholder="#sasavot #irl"><small>До 8 тегов через пробел</small></div>
    <label class="dropzone" id="dropzone" for="post-media">${icon('upload-simple')}<strong>Перетащите фото или видео</strong><span>JPG, PNG, WEBP, MP4, WEBM. До 80 МБ.</span><input id="post-media" name="media" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" hidden></label>
    <div id="file-preview"></div><div id="publish-error"></div>
    <div class="form-actions"><button class="secondary-button" type="button" data-action="close-modal">Отмена</button><button class="primary-button" type="submit">Опубликовать</button></div>
  </form>`);
  bindDropzone();
}

function openSettingsModal() {
  if (!ensureAuth()) return;
  openModal('Настройки профиля', `<form id="settings-form" class="form-grid"><div class="field"><label for="display-name">Отображаемое имя</label><input id="display-name" name="displayName" minlength="2" maxlength="48" required value="${escapeHTML(state.user.displayName)}"></div><div class="field"><label for="profile-bio">Описание</label><textarea id="profile-bio" name="bio" maxlength="280" placeholder="Расскажите о себе">${escapeHTML(state.user.bio || '')}</textarea><small>До 280 символов</small></div><div id="settings-error"></div><div class="form-actions"><button class="primary-button" type="submit">Сохранить</button></div></form>`);
}

async function submitSettings(form) {
  try {
    const values = Object.fromEntries(new FormData(form));
    const { user } = await api('/api/profile', { method: 'PATCH', body: JSON.stringify(values) });
    state.user = user;
    closeModal(); updateAccount(); toast('Профиль обновлён'); renderProfile(user.username);
  } catch (error) { $('#settings-error').innerHTML = `<div class="form-error">${escapeHTML(error.message)}</div>`; }
}

async function logout() {
  await api('/api/auth/logout', { method: 'POST', body: '{}' });
  state.user = null;
  updateAccount();
  location.hash = '#/feed';
  toast('Вы вышли из аккаунта');
}

function bindDropzone() {
  const dropzone = $('#dropzone');
  const input = $('#post-media');
  ['dragenter', 'dragover'].forEach((name) => dropzone.addEventListener(name, (event) => { event.preventDefault(); dropzone.classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach((name) => dropzone.addEventListener(name, (event) => { event.preventDefault(); dropzone.classList.remove('dragging'); }));
  dropzone.addEventListener('drop', (event) => { input.files = event.dataTransfer.files; previewFile(input.files[0]); });
  input.addEventListener('change', () => previewFile(input.files[0]));
}

function previewFile(file) {
  if (!file) return;
  const preview = $('#file-preview');
  if (file.type.startsWith('image')) preview.innerHTML = `<div class="file-preview"><img src="${URL.createObjectURL(file)}" alt="Предпросмотр загрузки"></div>`;
  else preview.innerHTML = `<div class="form-error">Выбрано видео: ${escapeHTML(file.name)} (${formatNumber(file.size / 1024 / 1024)} МБ)</div>`;
}

async function submitPost(form) {
  const button = $('button[type="submit"]', form);
  button.disabled = true; button.textContent = 'Публикуем...';
  try {
    await api('/api/posts', { method: 'POST', body: new FormData(form) });
    closeModal(); toast('Публикация уже в ленте'); location.hash = '#/feed'; await loadFeed();
  } catch (error) { $('#publish-error').innerHTML = `<div class="form-error">${escapeHTML(error.message)}</div>`; button.disabled = false; button.textContent = 'Опубликовать'; }
}

async function openComments(postId) {
  const post = state.posts.find((item) => item.id === postId);
  openModal(`Комментарии${post ? `: ${post.title}` : ''}`, `<form class="comment-form" id="comment-form" data-post-id="${postId}"><input name="body" maxlength="2000" placeholder="Написать комментарий" aria-label="Комментарий"><button class="primary-button" type="submit">Отправить</button></form><div class="comments"><div class="skeleton hero-skeleton"></div></div>`);
  try {
    const { comments } = await api(`/api/posts/${postId}/comments`);
    renderComments(comments);
  } catch (error) { $('.comments').innerHTML = errorState(error.message); }
}

function renderComments(comments) {
  $('.comments').innerHTML = comments.length ? comments.map((comment) => `
    <article class="comment ${comment.parentId ? 'reply' : ''}">${avatar(comment.author, 'small')}<div class="comment-bubble"><strong>@${escapeHTML(comment.author.username)}</strong><span class="comment-time">${timeAgo(comment.createdAt)}</span><p>${escapeHTML(comment.body)}</p></div></article>`).join('') : emptyState('chat-circle', 'Комментариев пока нет', 'Начните обсуждение первым.');
}

async function submitComment(form) {
  if (!ensureAuth()) return;
  const body = new FormData(form).get('body');
  try {
    await api(`/api/posts/${form.dataset.postId}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
    const { comments } = await api(`/api/posts/${form.dataset.postId}/comments`);
    form.reset(); renderComments(comments); toast('Комментарий опубликован');
  } catch (error) { toast(error.message, 'warning-circle'); }
}

async function setReaction(button, type) {
  if (!ensureAuth()) return;
  const card = button.closest('[data-post-id]');
  if (!card) return;
  try {
    const payload = await api(`/api/posts/${card.dataset.postId}/reaction`, { method: 'PUT', body: JSON.stringify({ type }) });
    const post = state.posts.find((item) => item.id === card.dataset.postId);
    if (post) { post.reactions = payload.reactions; post.viewerReaction = payload.viewerReaction; }
    const mainButton = $('.reaction-wrap > .action-button', card);
    if (mainButton) { mainButton.classList.toggle('active', Boolean(payload.viewerReaction)); mainButton.dataset.reaction = payload.viewerReaction || 'fire'; mainButton.innerHTML = `<span>${payload.viewerReaction ? reactionIcons[payload.viewerReaction] : '🔥'}</span><span>${formatNumber(totalReactions(post))}</span>`; }
  } catch (error) { toast(error.message, 'warning-circle'); }
}

async function toggleBookmark(button, postId) {
  if (!ensureAuth()) return;
  try {
    const { bookmarked } = await api(`/api/posts/${postId}/bookmark`, { method: 'PUT', body: '{}' });
    button.classList.toggle('active', bookmarked);
    button.innerHTML = icon('bookmark-simple', bookmarked);
    const post = state.posts.find((item) => item.id === postId); if (post) post.bookmarked = bookmarked;
    toast(bookmarked ? 'Сохранено в избранное' : 'Удалено из избранного', 'bookmark-simple');
  } catch (error) { toast(error.message, 'warning-circle'); }
}

async function toggleFollow(button, userId) {
  if (!ensureAuth()) return;
  try {
    const { following } = await api(`/api/users/${userId}/follow`, { method: 'PUT', body: '{}' });
    button.textContent = following ? 'Вы подписаны' : 'Подписаться';
    toast(following ? 'Автор появился в подписках' : 'Подписка отменена', 'user-plus');
  } catch (error) { toast(error.message, 'warning-circle'); }
}

function openPostMenu(postId) {
  openModal('Действия с публикацией', `<div class="form-grid"><button class="secondary-button" type="button" data-share="${postId}">Поделиться</button><button class="secondary-button" type="button" data-action="report" data-report-post="${postId}">Пожаловаться</button></div>`);
}

function openReportModal(postId) {
  if (!ensureAuth()) return;
  openModal('Жалоба на публикацию', `<form id="report-form" class="form-grid" data-post-id="${postId}"><div class="field"><label for="report-reason">Причина</label><select id="report-reason" name="reason"><option>Спам</option><option>Оскорбления</option><option>Опасный контент</option><option>Нарушение авторских прав</option><option>Неверная категория</option><option>Другое</option></select></div><div class="field"><label for="report-details">Подробности</label><textarea id="report-details" name="details" maxlength="600" placeholder="Помогите модератору понять проблему"></textarea></div><div id="report-error"></div><div class="form-actions"><button class="primary-button" type="submit">Отправить</button></div></form>`);
}

async function submitReport(form) {
  try {
    const values = Object.fromEntries(new FormData(form));
    const payload = await api(`/api/posts/${form.dataset.postId}/report`, { method: 'POST', body: JSON.stringify(values) });
    closeModal(); toast(payload.message, 'shield-check');
  } catch (error) { $('#report-error').innerHTML = `<div class="form-error">${escapeHTML(error.message)}</div>`; }
}

function openMedia(src) {
  openModal('Медиа', `<img src="${escapeHTML(src)}" alt="Открытое изображение" style="width:100%;border-radius:12px">`, true);
}

function showAchievements() {
  openModal('Достижения', `<div class="achievement-grid">${rule('star', 'Первый пост', 'Опубликована первая работа.')}${rule('fire', 'Залетел', 'Получено 100 реакций.')}${rule('palette', 'Художник', 'Опубликовано 10 творческих работ.')}${rule('crown', 'Легенда', 'Автор вошёл в топ месяца.')}</div>`, true);
}

async function sharePost(postId) {
  const url = `${location.origin}${location.pathname}#/post/${postId}`;
  try {
    if (navigator.share) await navigator.share({ title: 'САСАВОТ Community', url });
    else { await navigator.clipboard.writeText(url); toast('Ссылка скопирована', 'link'); }
  } catch (error) { if (error.name !== 'AbortError') toast('Не удалось поделиться', 'warning-circle'); }
}

function setupSearch() {
  const input = $('#search-input');
  input.addEventListener('input', () => {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => performSearch(input.value), 220);
  });
  input.addEventListener('focus', () => { if (input.value.trim().length >= 2) performSearch(input.value); });
  document.addEventListener('click', (event) => { if (!event.target.closest('.search')) $('#search-popover').hidden = true; });
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); input.focus(); }
    if (event.key === 'Escape') closeModal();
  });
  $('#search-form').addEventListener('submit', (event) => { event.preventDefault(); performSearch(input.value); });
}

async function performSearch(value) {
  const query = value.trim().replace(/^#/, '');
  const popover = $('#search-popover');
  if (query.length < 2) { popover.hidden = true; return; }
  try {
    const result = await api(`/api/search?q=${encodeURIComponent(query)}`);
    popover.innerHTML = `${result.users.length ? `<div class="search-group-title">Авторы</div>${result.users.map((user) => `<button class="search-result" type="button" data-profile="${escapeHTML(user.username)}">${avatar(user, 'small')}<span><strong>${escapeHTML(user.displayName)}</strong><br><small>@${escapeHTML(user.username)}</small></span></button>`).join('')}` : ''}${result.posts.length ? `<div class="search-group-title">Публикации</div>${result.posts.slice(0, 4).map((post) => `<button class="search-result" type="button" data-post="${post.id}">${icon('article')}<span>${escapeHTML(post.title)}</span></button>`).join('')}` : ''}${!result.users.length && !result.posts.length ? '<div class="search-result">Ничего не найдено</div>' : ''}`;
    popover.hidden = false;
  } catch { popover.hidden = true; }
}

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('sasavot-theme', theme);
  const iconNode = $('[data-action="theme"] i');
  if (iconNode) iconNode.className = `ph ph-${theme === 'dark' ? 'moon' : 'sun'}`;
}

document.addEventListener('click', async (event) => {
  const route = event.target.closest('[data-route]')?.dataset.route;
  if (route) { location.hash = `#/${route}`; return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'publish') openPublishModal();
  if (action === 'account') state.user ? location.hash = `#/profile/${state.user.username}` : openAuthModal();
  if (action === 'close-modal') closeModal();
  if (action === 'mobile-menu') document.body.classList.toggle('menu-open');
  if (action === 'theme') applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  if (action === 'settings') openSettingsModal();
  if (action === 'logout') logout();
  if (action === 'post-menu') openPostMenu(event.target.closest('[data-post-id]').dataset.postId);
  if (action === 'report') openReportModal(event.target.closest('[data-report-post]').dataset.reportPost);
  if (action === 'achievements') showAchievements();
  if (action === 'random-meme' && state.posts.length) openMedia(state.posts[Math.floor(Math.random() * state.posts.length)].media);
  const authTab = event.target.closest('[data-auth-tab]')?.dataset.authTab;
  if (authTab) openAuthModal(authTab);
  const demo = event.target.closest('[data-demo-login]')?.dataset.demoLogin;
  if (demo) demoLogin(demo);
  const profile = event.target.closest('[data-profile]')?.dataset.profile;
  if (profile) { closeModal(); location.hash = `#/profile/${profile}`; }
  const search = event.target.closest('[data-search]')?.dataset.search;
  if (search) { $('#search-input').value = search; performSearch(search); $('#search-input').focus(); }
  const media = event.target.closest('[data-view-media]')?.dataset.viewMedia;
  if (media && !event.target.closest('button')) openMedia(media);
  const comments = event.target.closest('[data-comments]')?.dataset.comments;
  if (comments) openComments(comments);
  const bookmarkButton = event.target.closest('[data-bookmark]');
  if (bookmarkButton) toggleBookmark(bookmarkButton, bookmarkButton.dataset.bookmark);
  const followButton = event.target.closest('[data-follow]');
  if (followButton) toggleFollow(followButton, followButton.dataset.follow);
  const share = event.target.closest('[data-share]')?.dataset.share;
  if (share) sharePost(share);
  const reactionButton = event.target.closest('[data-reaction]');
  if (reactionButton) setReaction(reactionButton, reactionButton.dataset.reaction);
  const mode = event.target.closest('[data-mode]')?.dataset.mode;
  if (mode) { state.mode = mode; loadFeed(); }
  const category = event.target.closest('[data-category]')?.dataset.category;
  if (category) { state.category = category; loadFeed(); }
  const postId = event.target.closest('[data-post]')?.dataset.post;
  if (postId) { const card = document.querySelector(`[data-post-id="${CSS.escape(postId)}"]`); if (card) { $('#search-popover').hidden = true; card.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }
  const modButton = event.target.closest('[data-mod-action]');
  if (modButton) {
    const item = modButton.closest('[data-report-id]');
    try { await api(`/api/moderation/reports/${item.dataset.reportId}`, { method: 'PATCH', body: JSON.stringify({ action: modButton.dataset.modAction }) }); item.remove(); toast('Решение сохранено', 'shield-check'); } catch (error) { toast(error.message, 'warning-circle'); }
  }
});

document.addEventListener('submit', (event) => {
  if (event.target.matches('#auth-form')) { event.preventDefault(); submitAuth(event.target); }
  if (event.target.matches('#publish-form')) { event.preventDefault(); submitPost(event.target); }
  if (event.target.matches('#comment-form')) { event.preventDefault(); submitComment(event.target); }
  if (event.target.matches('#report-form')) { event.preventDefault(); submitReport(event.target); }
  if (event.target.matches('#settings-form')) { event.preventDefault(); submitSettings(event.target); }
});

async function init() {
  applyTheme(state.theme);
  renderNavigation();
  setupSearch();
  try {
    const session = await api('/api/session');
    state.user = session.user;
    state.demoMode = session.demoMode;
  } catch { /* guest mode */ }
  updateAccount();
  await renderRoute();
}

window.addEventListener('hashchange', renderRoute);
init();
